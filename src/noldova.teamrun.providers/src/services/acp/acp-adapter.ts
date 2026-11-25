/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import "@noldova/context.core";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import { Resources as CoreResources, type ForkRequest, type ILog, type IProviderAdapter, type ITimer, type ITurnListener, NodeTimer, PlanReading, type ProfileSearch, SharedMcpFailure,
  SharedMcpFailureKind, SharedMcpRefusal, SignInCheck, TimeoutException, TurnDetail, type McpEndpoint, type TurnRequest, TurnOutcome, TurnResult, type TurnSteer, type TurnTools, type WakeTurn }
  from "@noldova/teamrun.core";
import { RoleApplication, AuthStatus, DetailKind, ForkedSession, type MessageAttachment, ObservedSettings, type OwnMcpServer, type PlanWindow, ReplyAction, ReplyUsage, type Provider,
  ProviderIdentity, type ProviderKind, type ProviderMode, ProviderModel, ProviderModelList, RequestedSettings, Resources as ProtocolResources,
  SenderEnvironment, type SharedMcpServerDefinition, type ProviderSignInCommand } from "@noldova/teamrun.protocol";

import { MessageFraming } from "../../enums/message-framing.js";
import { AcpRequestException } from "../../exceptions/acp-request.exception.js";
import { ForkUnavailableException } from "../../exceptions/fork-unavailable.exception.js";
import { ModelListException } from "../../exceptions/model-list.exception.js";
import { ModelUnavailableException } from "../../exceptions/model-unavailable.exception.js";
import { ProviderStoppedException } from "../../exceptions/provider-stopped.exception.js";
import { SettingUnavailableException } from "../../exceptions/setting-unavailable.exception.js";
import { SignInException } from "../../exceptions/sign-in.exception.js";
import { SignOutException } from "../../exceptions/sign-out.exception.js";
import { TaskException } from "../../exceptions/task.exception.js";
import { ToolsUnavailableException } from "../../exceptions/tools-unavailable.exception.js";
import { UnsupportedVersionException } from "../../exceptions/unsupported-version.exception.js";
import type { IAcpAgent } from "../../interfaces/i-acp-agent.js";
import type { IAcpOwnMcpServersReader } from "../../interfaces/i-acp-own-mcp-servers.reader.js";
import type { IAcpSteering } from "../../interfaces/i-acp-steering.js";
import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import type { IProcessTree } from "../../interfaces/i-process-tree.js";
import type { ISavedImageReader } from "../../interfaces/i-saved-image.reader.js";
import { AcpConfigOption } from "../../models/acp-config-option.js";
import { AcpHeldSteer } from "../../models/acp-held-steer.js";
import { AcpModelChoices } from "../../models/acp-model-choices.js";
import { AcpServedEndpoint } from "../../models/acp-served-endpoint.js";
import { AcpSession } from "../../models/acp-session.js";
import type { AppServerClientInfo } from "../../models/app-server-client-info.js";
import { LaunchedAcpClient } from "../../models/launched-acp-client.js";
import { ProcessOrigin } from "../../models/process-origin.js";
import type { ProviderTimings } from "../../models/provider-timings.js";
import { Resources } from "../../resources.js";
import { FailureDescriber } from "../failure-describer.js";
import { ReadOnlyMcpTools } from "../mcp/read-only-mcp-tools.js";
import { ServedToolNames } from "../mcp/served-tool-names.js";
import { SharedMcpLaunch } from "../mcp/shared-mcp-launch.js";
import { CommandRunner } from "../process/command-runner.js";
import { PowershellSession } from "../process/powershell-session.js";
import { ProcessTree } from "../process/process-tree.js";
import { TerminalSignIn } from "../terminal-sign-in.js";
import { UsageValues } from "../usage-values.js";
import { AcpChannel } from "./acp-channel.js";
import { AcpClient } from "./acp-client.js";
import { AcpCommands } from "./acp-commands.js";
import { AcpEnvironment } from "./acp-environment.js";
import { AcpKeptSession } from "./acp-kept-session.js";
import { AcpSessionOpener } from "./acp-session-opener.js";
import { AcpTerminals } from "./acp-terminals.js";
import { AcpTurn } from "./acp-turn.js";

export class AcpAdapter implements IProviderAdapter {
  private static readonly noReplyUsage: ReplyUsage = new ReplyUsage(null, null, null, null);
  private static readonly launch: SharedMcpLaunch = new SharedMcpLaunch();
  private readonly agent: IAcpAgent;
  private readonly clientInfo: AppServerClientInfo;
  private readonly starter: IProcessStarter;
  private readonly timings: ProviderTimings;
  private readonly timer: ITimer;
  private readonly savedImages: ISavedImageReader | null;
  private readonly sessionLog: ILog | null;
  private readonly processTree: IProcessTree;
  private readonly clients: Map<AcpClient, string | null> = new Map();
  private readonly channels: Map<AcpClient, AcpChannel> = new Map();
  private readonly listed: Map<string | null, readonly ProviderModel[]> = new Map();
  private readonly signingOut: Set<string | null> = new Set();
  private readonly stoppedForSignOut: WeakSet<AcpClient> = new WeakSet();
  private readonly sessionsWithoutHome: Set<string> = new Set();
  private readonly sessionsWithoutChat: Set<string> = new Set();
  private readonly idleTimer: ITimer;
  private readonly kept: Map<AcpClient, AcpKeptSession> = new Map();
  private readonly runningSessions: Set<string> = new Set();
  private readonly closingSessions: Set<string> = new Set();
  private readonly sessionModes: Map<AcpClient | null, string | null> = new Map();
  private shutdowns: number = 0;

  public readonly descriptor: ProviderKind;
  public readonly takesTeamRunTools: boolean = true;
  public readonly askIsolated?: (request: TurnRequest, listener: ITurnListener, signal: AbortSignal) => Promise<TurnResult | null>;
  public readonly profileSearch?: ProfileSearch;

  public constructor(agent: IAcpAgent, clientInfo: AppServerClientInfo, starter: IProcessStarter, timings: ProviderTimings,
    timer: ITimer = new NodeTimer(), savedImages: ISavedImageReader | null = null, log: ILog | null = null,
    processTree: IProcessTree = new ProcessTree(process.platform, new CommandRunner(starter), process.env, Resources.processListTimeout, timer, timings.stopGrace,
      undefined, PowershellSession.shared, undefined, log), idleTimer: ITimer = new NodeTimer()) {
    this.agent = agent;
    const isolatedMode = agent.isolatedMode;
    if (!Object.isUndefined(isolatedMode))
      this.askIsolated = (request, listener, signal) => agent.hasNoIsolatedAsk?.(request.provider) === true ? Promise.resolve(null)
        : this.runTurn(request.withRequested(new RequestedSettings(request.requested.kind, request.requested.model, request.requested.effort,
          request.requested.speed, isolatedMode)), listener, signal);
    this.descriptor = agent.descriptor;
    if (!Object.isNull(agent.profileSearch))
      this.profileSearch = agent.profileSearch;
    this.clientInfo = clientInfo;
    this.starter = starter;
    this.timings = timings;
    this.timer = timer;
    this.savedImages = savedImages;
    this.sessionLog = log;
    this.processTree = processTree;
    this.idleTimer = idleTimer;
  }

  public get modes(): readonly ProviderMode[] {
    return this.agent.modes;
  }

  public get defaultMode(): string | null {
    return this.agent.defaultMode;
  }

  public get planMode(): string | null {
    return this.agent.planMode ?? null;
  }

  public get backgroundSubAgentsNote(): string | null {
    return this.agent.backgroundSubAgentsNote;
  }

  public sharedServerUnavailable(server: SharedMcpServerDefinition, provider: Provider | null = null, workingDirectory: string | null = null)
    : SharedMcpRefusal | null {
    return AcpAdapter.launch.refusalOf(server, this.descriptor.displayName)
      ?? (this.agent.sharedServerTransports.includes(server.transport) ? null
        : this.agent.sharedServerRefusal ?? new SharedMcpRefusal(Resources.formatSharedMcpUnconfirmed(this.descriptor.displayName), Resources.sharedMcpUnconfirmedShort))
      ?? this.agent.sharedServerNameRefusal?.(server.name, provider, workingDirectory) ?? null;
  }

  public savedSecretsUnavailable(): SharedMcpRefusal | null {
    return null;
  }

  public async listModels(provider: Provider | null): Promise<ProviderModelList> {
    const list = await this.listAgentModels(provider);
    if (list.models.length > 0)
      this.listed.set(provider?.id ?? null, list.models);
    return this.withModes(list);
  }

  protected withModes(list: ProviderModelList): ProviderModelList {
    return new ProviderModelList(list.models, list.signedIn, list.empty, list.planName, list.awaitsTurn, this.agent.modes, this.agent.defaultMode);
  }

  private async listAgentModels(provider: Provider | null): Promise<ProviderModelList> {
    const signedIn = this.agent.isSignedIn(provider);
    if (signedIn === false)
      return new ProviderModelList([], false);
    const turnModels = this.agent.turnModels;
    if (!Object.isNull(turnModels)) {
      const kept = turnModels.read(provider);
      return new ProviderModelList(kept ?? [], signedIn, false, null, Object.isNull(kept));
    }
    const { client, environment } = await this.createClient(provider, null);
    try {
      const initialized = await this.initializeSignedIn(client);
      if (Object.isNull(initialized))
        return new ProviderModelList([], false);
      if (this.agent.authenticates) {
        const first = this.agent.readModels(initialized);
        const offered = this.canAuthenticate(initialized);
        if (Object.isNull(first))
          return new ProviderModelList([], offered);
        const listed = this.loaded(first) ? first : await this.listedModels(client, initialized) ?? first;
        return this.loaded(listed) ? new ProviderModelList(listed, offered) : new ProviderModelList([], offered, true);
      }
      const session = await this.probeSession(client, initialized);
      return Object.isNull(session) ? new ProviderModelList([], false)
        : new ProviderModelList(await this.withListedLevels(provider, environment, this.optionModels(initialized, session)), true);
    }
    finally {
      await this.close(client);
    }
  }

  public prepareProfile(provider: Provider): void {
    this.agent.prepareProfile?.(provider);
  }

  public checkFoundSignIn(provider: Provider): Promise<SignInCheck> {
    const signedIn = this.agent.isSignedIn(provider);
    return Promise.resolve(new SignInCheck(Object.isNull(signedIn) ? AuthStatus.Unknown : signedIn ? AuthStatus.LoggedIn : AuthStatus.LoggedOut, null, null, null));
  }

  public async readServerVersion(): Promise<string | null> {
    const { client } = await this.createClient(null, null, true);
    try {
      return this.agent.readVersion(await this.requestInitialize(client));
    }
    finally {
      await this.close(client);
    }
  }

  public async checkSignIn(provider: Provider): Promise<SignInCheck> {
    let client: AcpClient | null = null;
    let version: string | null = null;
    try {
      if (this.agent.isSignedIn(provider) === false && Object.isNull(provider.binaryPath))
        return new SignInCheck(AuthStatus.LoggedOut, null, null, this.agent.formatSignIn(provider));
      client = (await this.createClient(provider, null, this.agent.isSignedIn(provider) === false)).client;
      const initialized = await this.initializeSignedIn(client);
      if (Object.isNull(initialized))
        return new SignInCheck(AuthStatus.LoggedOut, null, null, this.agent.formatSignIn(provider));
      version = this.agent.readVersion(initialized);
      const signedIn = this.agent.isSignedIn(provider) !== false
        && (this.agent.authenticates ? this.canAuthenticate(initialized) : !Object.isNull(await this.probeSession(client, initialized)));
      if (!signedIn)
        return new SignInCheck(AuthStatus.LoggedOut, null, version, this.agent.formatSignIn(provider));
      if (!this.agent.interactiveSignIn)
        await this.authenticate(client);
      const account = this.agent.account;
      const identity = Object.isNull(account) ? null : await this.requestExtension(client, account.methods, {}, t => account.read(t), this.timings.accountTimeout, true);
      const plan = Object.isNull(account) ? null : await this.requestExtension(client, account.planMethods, {}, t => account.readPlan(t), this.timings.accountTimeout);
      return new SignInCheck(AuthStatus.LoggedIn, Object.isNull(plan) ? identity
        : new ProviderIdentity(identity?.email, plan, identity?.organization, identity?.authMethod, identity?.userName), version, null);
    }
    catch (error) {
      return new SignInCheck(AuthStatus.Error, null, version, FailureDescriber.describe(error));
    }
    finally {
      if (!Object.isNull(client))
        await this.close(client);
    }
  }

  public async signIn(provider: Provider, signal: AbortSignal): Promise<void> {
    const { client } = await this.createClient(provider, null, true);
    const stop = (): void => {
      void client.stop().catch(() => undefined);
    };
    signal.addEventListener(Resources.abortEvent, stop, { once: true });
    try {
      const initialized = await this.initialize(client);
      if (this.agent.authenticates && Object.isNull(this.agent.isSignedIn(provider)) && this.canAuthenticate(initialized))
        return;
      if (this.needsNoSignIn(provider, initialized))
        return;
      const method = this.agent.readSignInMethod(initialized);
      if (Object.isNull(method))
        throw new SignInException(this.agent.signInUnavailable);
      await client.request(Resources.acpAuthenticate, { methodId: method }, null);
    }
    finally {
      signal.removeEventListener(Resources.abortEvent, stop);
      await this.close(client);
    }
  }

  public async readSignInCommand(provider: Provider): Promise<ProviderSignInCommand | null> {
    const signIn = this.agent.descriptor.profile?.signInCommand ?? null;
    if (!Object.isNull(signIn))
      return TerminalSignIn.of(this.agent.currentCommand?.() ?? null, signIn, await this.starter.readEnvironmentAsync(this.agent.baseEnvironment));
    const read = this.agent.readTerminalSignIn?.bind(this.agent);
    if (Object.isUndefined(read))
      return null;
    const { client } = await this.createClient(provider, null);
    try {
      return read(await this.initialize(client));
    }
    finally {
      await this.close(client);
    }
  }

  public async signOut(provider: Provider): Promise<void> {
    const signOut = this.agent.signOut;
    if (Object.isNull(signOut) && !this.agent.logsOut)
      throw new SignOutException(Resources.signOutNotSupported);
    if (Object.isNull(signOut))
      return await this.logOut(provider);
    await this.stopRunning(provider);
    const { client } = await this.createClient(provider, null);
    try {
      const initialized = await this.initialize(client);
      for (const method of signOut.methods) {
        const answer = await client.request(method, {}, this.timings.signInCheckTimeout).catch((error: unknown) => {
          if (error instanceof AcpRequestException && error.code === Resources.acpUnsupportedCode)
            return undefined;
          throw error;
        });
        const refusal = Object.isUndefined(answer) ? undefined : signOut.read(answer);
        if (typeof refusal === "string")
          throw new SignOutException(refusal);
        if (Object.isNull(refusal))
          return;
      }
      throw new SignOutException(Resources.formatAcpSignOutUnanswered(this.descriptor.displayName, this.agent.readVersion(initialized), signOut.methods));
    }
    finally {
      await this.close(client);
    }
  }

  public async runTurn(asked: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult> {
    const request = this.plannedOf(asked);
    const kindId = this.descriptor.id;
    let client: AcpClient | null = null;
    let launchEnvironment: NodeJS.ProcessEnv = this.agent.baseEnvironment;
    let sessionId: string | null = null;
    let observed = new ObservedSettings(kindId, null, null, null);
    let confirming: Promise<boolean> | null = null;
    const interruptWait = new AbortController();
    const toolsWait = new AbortController();
    const stopReport = new AbortController();
    let step = Resources.turnStepStart;
    const steers: Promise<boolean>[] = [];
    let revoke: () => void = () => undefined;
    let adopt: (tools: TurnTools) => void = () => undefined;
    const shutdowns = this.shutdowns;
    const startedAt = new Date().toISOString();
    let blocked: Set<string> | null = null;
    let keeping: AcpKeptSession | null = null;
    let unreported = false;
    const approvedTools = request.tools?.approvedTools ?? [];
    const readOnlyMode = this.agent.modes.find(t => t.id === asked.requested.mode && t.readOnly && t.id !== this.planMode);
    const readOnlyChat = !Object.isUndefined(readOnlyMode);
    const restartsPlan = readOnlyChat && asked !== request && this.agent.plans?.leavesPlan === true;
    const restarts = new Set<string>();
    const held: AcpHeldSteer[] = [];
    const leave = (t: string): Promise<void> => {
      if (!restartsPlan)
        return this.leavePlan(client, t, asked, request);
      this.sessionModes.set(client, this.agent.defaultMode);
      restarts.add(t);
      turn.restartAfterCancel();
      client?.notify(Resources.acpSessionCancel, { sessionId: t });
      return Promise.resolve();
    };
    const createTurn = (target: ITurnListener, turnSignal: AbortSignal): AcpTurn => new AcpTurn(kindId, this.descriptor.displayName, this.agent.toolTitle,
      target, turnSignal, this.timings.streamInterval, (tool, session) => this.savedImages?.read(tool, session, request.provider, request.workingDirectory) ?? null,
      this.agent.routedMcpTool, async t => (await request.tools?.host.listToolsAsync(t) ?? []).map(u => String(u[Resources.nameField])),
      (tool, session) => this.agent.toDos?.read(tool, session, request.provider) ?? null, tool => this.savedImages?.failureOf(tool) ?? null, this.agent.questions,
      this.agent.plans ?? null, leave, approvedTools, tool => this.agent.mcpToolOf?.(tool) ?? null,
      async t => Object.isNull(request.tools) ? [] : ReadOnlyMcpTools.listAsync(request.tools, t),
      !Object.isUndefined(this.agent.allowAllMode) && asked.requested.mode === this.agent.allowAllMode, asked !== request, this.agent.toDoList ?? null, readOnlyChat,
      this.agent.toolGate ?? null);
    const turn = createTurn(listener, signal);
    const sender = SenderEnvironment.read(request.environment);
    const commands = new AcpCommands();
    const terminals = this.agent.runsTerminals === true ? new AcpTerminals(listener, this.descriptor.displayName, this.starter, this.timer, request.workingDirectory,
      () => ({ ...launchEnvironment, ...request.environment }), this.originOf(request.provider), this.processTree, process.platform) : null;
    const channel = new AcpChannel(turn, this.agent.followsTasks ? listener : null, this.timer, this.timings.wakeGrace, async (t, u) => {
      await t.onToolsAsync(v => {
        adopt(v);
        return Promise.resolve();
      });
      if (!Object.isNull(sender))
        t.adoptSender(sender);
      await this.noteWakeModeAsync(client, request.requested.mode, t);
      const woken = createTurn(t, u);
      woken.switchingMode(this.switchWakeMode(client, sessionId, t));
      return woken;
    },
      t => client?.notify(Resources.acpSessionCancel, { sessionId: t }), (reason, session, seen) => this.wakeResult(reason, session, seen), this.descriptor.displayName,
      (t, u) => this.endTaskTree(client!, t, u), t => this.cancelSubAgent(client!, t), commands, terminals);
    const cancel = (): void => {
      if (!Object.isNull(client) && !Object.isNull(sessionId))
        client.notify(Resources.acpSessionCancel, { sessionId });
      void this.timer.delayAsync(this.timings.interruptGrace, interruptWait.signal).then(() => client?.stop()).catch(() => undefined);
      const subAgents = turn.subAgentStates;
      void this.timer.delayAsync(this.timings.stopReportWait, stopReport.signal)
        .then(() => this.sessionLog?.write(Resources.formatTurnStopStuck(this.descriptor.id, step, subAgents)), () => undefined);
    };
    signal.addEventListener(Resources.abortEvent, cancel, { once: true });
    try {
      if (signal.aborted)
        return new TurnResult(TurnOutcome.Interrupted, null, observed, null);
      const command = request.compacts ? null : request.command;
      if (!Object.isNull(command) && request.attachments.length > 0) {
        await listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatCommandWithFiles(this.descriptor.displayName, AcpCommands.shownOf(command)), null, null));
        return new TurnResult(TurnOutcome.Completed, request.resumeNativeSessionId, observed, null);
      }
      const titleArguments = request.isolated ? this.agent.titleSessionArguments ?? [] : [];
      const key = request.isolated ? null : AcpAdapter.keyOf(request, approvedTools, await ServedToolNames.listAsync(request.tools, signal));
      const taken = await this.take(key, request, sender);
      const launched = taken ?? await this.createClient(request.provider, request.requested, false, request.environment, request.workingDirectory, approvedTools, shutdowns,
        titleArguments, !request.isolated, request.isolated);
      client = launched.client;
      launchEnvironment = launched.environment;
      const initialized = taken?.initialized ?? await this.initialize(client);
      observed = new ObservedSettings(kindId, null, null, this.agent.readVersion(initialized));
      const models = this.agent.readModels(initialized);
      const selected = models?.find(t => t.matches(request.requested.model));
      const images = Object.isNull(models) ? AcpAdapter.takesImages(initialized) : selected?.supportsImages === true;
      const sent = images ? request : request.withoutImages();
      if (!Object.isNull(models) && !Object.isNull(request.requested.model) && Object.isUndefined(selected))
        throw this.loaded(models) ? new ModelUnavailableException(Resources.formatModelUnavailable(this.descriptor.displayName, request.requested.model))
          : new ModelListException(Resources.formatModelsNotLoaded(this.descriptor.displayName, request.requested.model));
      if (!Object.isNull(request.requested.effort) && !Object.isNullOrUndefined(selected?.effortLevels) && !selected.effortLevels.includes(request.requested.effort))
        throw new SettingUnavailableException(Resources.formatUnknownEffort(request.requested.effort, selected.displayName));
      if (!Object.isUndefined(readOnlyMode) && !Object.isUndefined(this.agent.toolGate) && Object.isNull(this.agent.toolGate.metaOf(initialized)))
        throw new SettingUnavailableException(Resources.formatModeUnavailable(this.descriptor.displayName, readOnlyMode.name));
      if (this.agent.authenticates && !this.canAuthenticate(initialized))
        throw new SignInException(this.agent.formatSignIn(request.provider));
      if (Object.isNull(taken))
        await this.authenticate(client);
      else
        commands.adopt(taken.commands);
      client.setListener(channel);
      this.channels.set(client, channel);
      const endpoint = this.endpointOf(request.tools, initialized);
      let served: AcpServedEndpoint | null = null;
      if (!Object.isNull(endpoint)) {
        const token = taken?.token ?? endpoint.issueKept();
        revoke = () => endpoint.revoke(token);
        adopt = tools => tools.adopt(token);
        served = new AcpServedEndpoint(endpoint.url, token);
      }
      const params = await this.paramsOf(request, initialized, served);
      const reopen = async (failure: unknown): Promise<AcpClient> => {
        if (shutdowns !== this.shutdowns || this.stoppedForSignOut.has(client!))
          throw failure;
        await this.close(client!);
        if (shutdowns !== this.shutdowns)
          throw failure;
        const relaunched = await this.createClient(request.provider, request.requested, false, request.environment, request.workingDirectory, approvedTools, shutdowns,
          titleArguments, !request.isolated, request.isolated);
        client = relaunched.client;
        launchEnvironment = relaunched.environment;
        await this.initialize(client);
        await this.authenticate(client);
        client.setListener(channel);
        this.channels.set(client, channel);
        return client;
      };
      const resume = this.agent.prefersResume && AcpAdapter.canResume(initialized);
      const session = Object.isNull(taken) ? await AcpSessionOpener.open(client, params, request.resumeNativeSessionId, listener, signal, this.timings.initializeTimeout,
        reopen, resume, !request.compacts) : new AcpSession(taken.sessionId, true, taken.started);
      const listedCompaction = request.compacts && !this.agent.compacts && this.agent.compactsIfListed === true;
      if (Object.isNull(session) || request.compacts && !this.agent.compacts && !listedCompaction) {
        const answer = Object.isNull(session) ? CoreResources.nothingToCompact : Resources.formatCannotCompact(this.descriptor.displayName);
        await listener.onDetailAsync(new TurnDetail(DetailKind.Note, answer, null, null));
        return new TurnResult(TurnOutcome.Completed, session?.id ?? null, observed, null);
      }
      const listedOnly = listedCompaction ? CoreResources.compactCommand : command;
      if (!Object.isNull(listedOnly)) {
        const names = await commands.listOf(session.id, this.timer, Resources.acpCommandsWait, signal) ?? [];
        const kept = session.resumed ? session.id : null;
        if (signal.aborted)
          return new TurnResult(TurnOutcome.Interrupted, kept, observed, null);
        if (!names.includes(AcpCommands.nameOf(listedOnly))) {
          await listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatCommandUnlisted(this.descriptor.displayName, AcpCommands.shownOf(listedOnly), names), null, null));
          return new TurnResult(TurnOutcome.Completed, kept, observed, null);
        }
      }
      const awaited = Object.isNull(command) && this.agent.awaitsTeamRunTools ? request.tools : null;
      const listsFirst = Object.isNull(taken) && this.agent.listsToolsBeforeSession?.(initialized) === true;
      const deadline = Object.isNull(awaited) || listsFirst || taken?.toolsUnlisted === true ? null
        : this.timer.delayAsync(Resources.teamRunToolsWait, AbortSignal.any([signal, toolsWait.signal])).then(() => true, () => false);
      const started = session.result;
      const resumed = session.resumed;
      sessionId = session.id;
      this.runningSessions.add(sessionId);
      const options = AcpConfigOption.readAll(started);
      if (!Object.isNull(options))
        this.logOptions(options);
      if (!resumed) {
        this.agent.readSession?.(started);
        this.keepModels(request.provider, initialized, started);
      }
      if (Object.isNull(options)) {
        observed = await this.selectModel(client, sessionId, started, resumed, request.requested, observed);
        await this.selectMode(client, sessionId, started, [], resumed, request.requested);
      }
      else
        [observed, confirming] = await this.configure(client, sessionId, started, options, resumed, request.provider, request.requested, observed);
      await turn.beginAsync(sessionId, resumed, observed, Object.isNull(request.instructions) || !Object.isNull(command) ? null : RoleApplication.Prompt);
      channel.follow(sessionId, observed);
      const unlistedAtStart = !Object.isNull(awaited) && (listsFirst ? !awaited.isListed : taken?.toolsUnlisted === true);
      const missing = Object.isNull(awaited) || unlistedAtStart || Object.isNull(deadline) ? null
        : await this.awaitTeamRunTools(awaited, deadline, toolsWait, client, request.provider, startedAt);
      const listed = !unlistedAtStart && Object.isNull(missing);
      const toolsUnlisted = taken?.toolsUnlisted === true || (listsFirst && !listed);
      if (!listed)
        await this.reportMissingToolsAsync(request, listener, initialized, launchEnvironment, missing);
      blocked = new Set<string>();
      await this.reportBlockedServersAsync(request, listener, startedAt, blocked);
      const text = !resumed || Object.isNull(command) && this.sessionsWithoutChat.delete(sessionId) ? sent.freshPrompt ?? sent.prompt : sent.prompt;
      const home = !request.isolated && Object.isNull(command) && (!resumed || this.sessionsWithoutHome.delete(sessionId)) ? this.agent.readHomeInstructions?.(launchEnvironment, request.workingDirectory) ?? null : null;
      if (!Object.isNull(command) && !resumed) {
        this.sessionsWithoutHome.add(sessionId);
        this.sessionsWithoutChat.add(sessionId);
      }
      const instructions = listed ? request.instructions : request.instructionsWithoutTools ?? request.instructions;
      const role = [home, instructions].filter((t): t is string => !Object.isNull(t)).join(Resources.lineSeparator + Resources.lineSeparator);
      const opening = request.compacts ? CoreResources.compactCommand : command ?? Resources.formatRolePrompt(role.length === 0 ? null : role, text);
      turn.noteSent(opening);
      turn.watchRefusals(t => this.agent.readRefusal?.(t) ?? null);
      if (request.isolated)
        turn.leaveOutNotices(this.agent.titleSessionNotice ?? null);
      const prompt = await this.blocksOf(opening, sent.attachments);
      if (signal.aborted)
        return new TurnResult(TurnOutcome.Interrupted, sessionId, this.unconfirmed(observed, request.requested), null);
      const current = client;
      const steered = sessionId;
      const steering = this.agent.steering;
      if (!Object.isUndefined(steering))
        listener.onSteerable?.(t => {
          if (restarts.has(steered)) {
            const sent = Promise.withResolvers<boolean>();
            held.push(new AcpHeldSteer(t, sent));
            steers.push(sent.promise);
            return sent.promise;
          }
          const taken = this.steer(current, steering, steered, t);
          steers.push(taken);
          return taken;
        });
      step = Resources.turnStepPrompt;
      let result = JsonReader.fromValue(await client.request(Resources.acpSessionPrompt, { sessionId, prompt }, null));
      if (restarts.has(sessionId))
        try {
          await this.leavePlan(client, sessionId, asked, request);
          if (!signal.aborted && result.readNonBlankString(Resources.acpStopReasonField) === Resources.acpCancelled) {
            turn.noteSent(CoreResources.planApprovedPrompt);
            const sending = [...held];
            const answer = client.request(Resources.acpSessionPrompt, { sessionId, prompt: await this.restartBlocksOf(sending) }, null);
            restarts.delete(sessionId);
            sending.forEach(t => t.sent.resolve(true));
            result = JsonReader.fromValue(await answer);
          }
        }
        finally {
          restarts.delete(sessionId);
          held.forEach(t => t.sent.resolve(false));
        }
      step = Resources.turnStepAnswer;
      const reason = result.readNonBlankString(Resources.acpStopReasonField);
      if (signal.aborted || reason === Resources.acpCancelled)
        return new TurnResult(TurnOutcome.Interrupted, sessionId, this.unconfirmed(observed, request.requested), null, turn.nativeTurnId);
      if (reason !== Resources.acpEndTurn && !this.agent.stopReasons.includes(reason))
        throw new ProviderStoppedException(this.agent.formatStopped(reason));
      if (!Object.isNull(turn.refusal))
        throw turn.refusal;
      await this.reportUsage(client, sessionId, result.toJson(), listener);
      await this.reportPlanUsage(client, request.provider, listener, turn.lastText);
      if (request.compacts)
        this.sessionsWithoutHome.add(sessionId);
      unreported = listedCompaction && !turn.compacted;
      const confirmed = Object.isNull(confirming) || await this.confirm(confirming, signal);
      if (!Object.isNull(key))
        keeping = new AcpKeptSession(client, launchEnvironment, sessionId, key, JSON.stringify(params), initialized, started, toolsUnlisted, taken?.sender ?? sender,
          served?.token ?? null, revoke, channel, commands, this.idleTimer, this.timings.idleLimit, this.timings.silenceLimit, t => void this.closeQuietly(t.client),
          t => void this.stopKept(t));
      return new TurnResult(TurnOutcome.Completed, sessionId, confirmed ? observed : this.unconfirmed(observed, request.requested), null, turn.nativeTurnId);
    }
    catch (error) {
      step = Resources.turnStepHandled;
      if (!Object.isNull(client))
        await client.whenHandledAsync();
      if (!Object.isNull(client) && !signal.aborted)
        await this.reportPlanAfterFailure(client, request.provider, listener, error);
      const failure = turn.contextFull ? Resources.formatContextFull(this.descriptor.displayName)
        : !Object.isNull(client) && this.stoppedForSignOut.has(client) ? Resources.formatTurnStoppedForSignOut(this.descriptor.displayName)
        : !this.agent.authenticates && this.isAuthRequired(error) ? this.agent.formatSignIn(request.provider) : FailureDescriber.describe(error);
      return new TurnResult(signal.aborted ? TurnOutcome.Interrupted : TurnOutcome.Failed, sessionId, this.unconfirmed(observed, request.requested), signal.aborted ? null : failure,
        turn.nativeTurnId, !signal.aborted && error instanceof ModelUnavailableException ? ReplyAction.ChooseModel : null);
    }
    finally {
      listener.onSteerable?.(null);
      held.forEach(t => t.sent.resolve(false));
      signal.removeEventListener(Resources.abortEvent, cancel);
      interruptWait.abort();
      toolsWait.abort();
      try {
        step = Resources.turnStepHandled;
        if (!Object.isNull(client))
          await client.whenHandledAsync();
        step = Resources.turnStepBlockedServers;
        if (!Object.isNull(blocked))
          await this.reportBlockedServersAsync(request, listener, startedAt, blocked);
        step = Resources.turnStepFinish;
        await turn.finishAsync();
        step = Resources.turnStepCompaction;
        if (unreported)
          await listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatCompactionUnreported(this.descriptor.displayName), null, null));
        if (turn.compacted && !Object.isNull(sessionId))
          this.sessionsWithoutHome.add(sessionId);
        step = Resources.turnStepSteers;
        await this.settle(steers);
        step = Resources.turnStepRelease;
        if (!Object.isNull(client))
          await this.release(client, channel, shutdowns, revoke, keeping, sessionId);
      }
      finally {
        stopReport.abort();
      }
    }
  }

  public async listOwnMcpServers(provider: Provider | null): Promise<readonly OwnMcpServer[] | null> {
    const reader = this.agent.ownMcpServers;
    if (!Object.isUndefined(reader))
      return await this.requestOwnMcpServers(provider, reader);
    return await this.agent.listOwnMcpServers?.(provider) ?? null;
  }

  public async readPlanUsage(provider: Provider | null): Promise<PlanReading | null> {
    const usage = this.agent.usage;
    if (Object.isNull(usage) || usage.planMethods.length === 0)
      return new PlanReading([]);
    let client: AcpClient | null = null;
    try {
      client = (await this.createClient(provider, null)).client;
      const initialized = await this.initialize(client);
      if (this.agent.authenticates && !this.canAuthenticate(initialized))
        return null;
      await this.authenticate(client);
      const windows = await this.requestExtension(client, usage.planMethods, {}, t => usage.readPlan(t));
      return Object.isNull(windows) ? null : new PlanReading(windows);
    }
    catch {
      return null;
    }
    finally {
      if (!Object.isNull(client))
        await this.close(client);
    }
  }

  public closeSessions(nativeSessionIds: readonly string[]): Promise<void> {
    for (const kept of [...this.kept.values()].filter(t => nativeSessionIds.includes(t.sessionId)))
      kept.retire();
    for (const sessionId of nativeSessionIds.filter(t => this.runningSessions.has(t)))
      this.closingSessions.add(sessionId);
    return Promise.resolve();
  }

  public async forkSession(request: ForkRequest): Promise<ForkedSession> {
    const methods = this.agent.forkMethods;
    if (methods.length === 0)
      throw new ForkUnavailableException(Resources.formatForkUnavailable(this.descriptor.displayName));
    const index = Number(request.lastTurnId);
    if (!Resources.promptIndexPattern.test(request.lastTurnId) || !Number.isSafeInteger(index))
      throw new ForkUnavailableException(Resources.formatPromptIndexInvalid(request.lastTurnId));
    let client: AcpClient | null = null;
    try {
      client = (await this.createClient(request.provider, request.requested, false, {}, request.workingDirectory)).client;
      const initialized = await this.initialize(client);
      if (this.agent.authenticates && !this.canAuthenticate(initialized))
        throw new SignInException(this.agent.formatSignIn(request.provider));
      await this.authenticate(client);
      const params: Record<string, JsonValue> = {
        [Resources.xaiSourceSessionIdField]: request.nativeSessionId,
        [Resources.xaiSourceCwdField]: request.workingDirectory,
        [Resources.xaiNewCwdField]: request.workingDirectory,
        [Resources.xaiTargetPromptIndexField]: index
      };
      const forked = JsonReader.fromValue(await this.requestFirst(client, methods, params));
      return new ForkedSession(this.descriptor.id, request.provider?.id ?? null, forked.readNonBlankString(Resources.xaiNewSessionIdField));
    }
    finally {
      if (!Object.isNull(client))
        await this.close(client);
    }
  }

  public async shutdown(): Promise<void> {
    this.shutdowns += 1;
    const waited = new AbortController();
    await Promise.race([Promise.all([...this.channels.values()].map(t => t.stopTasks())),
      this.timer.delayAsync(this.timings.interruptTimeout, waited.signal).catch(() => undefined)]);
    waited.abort();
    await Promise.all([...this.clients.keys()].map(t => this.close(t)));
  }

  private async reportUsage(client: AcpClient, sessionId: string, answer: JsonValue, listener: ITurnListener): Promise<void> {
    const usage = this.agent.usage;
    if (Object.isNull(usage))
      return;
    const reply = usage.readReply(answer);
    const context = await this.requestExtension(client, usage.contextMethods, { sessionId }, t => usage.readContext(t));
    const reported = Object.isNull(context) ? reply : (reply ?? AcpAdapter.noReplyUsage).merge(new ReplyUsage(null, null, null, context));
    if (!Object.isNull(reported))
      await listener.onUsageAsync(reported);
  }

  private async requestOwnMcpServers(provider: Provider | null, reader: IAcpOwnMcpServersReader): Promise<readonly OwnMcpServer[] | null> {
    const { client } = await this.createClient(provider, null);
    try {
      const initialized = await this.initialize(client);
      if (this.agent.authenticates && !this.canAuthenticate(initialized))
        throw new SignInException(this.agent.formatSignIn(provider));
      await this.authenticate(client);
      let answer: JsonValue;
      try {
        answer = await this.requestFirst(client, reader.methods, {});
      }
      catch (error) {
        if (error instanceof AcpRequestException && error.code === Resources.acpUnsupportedCode)
          return null;
        throw error;
      }
      return reader.read(answer);
    }
    finally {
      await this.close(client);
    }
  }

  private async settle(steers: readonly Promise<boolean>[]): Promise<void> {
    const elapsed = new AbortController();
    try {
      await Promise.race([Promise.all(steers), this.timer.delayAsync(this.timings.requestTimeout, elapsed.signal)]);
    }
    finally {
      elapsed.abort();
    }
  }

  private async steer(client: AcpClient, steering: IAcpSteering, sessionId: string, steer: TurnSteer): Promise<boolean> {
    try {
      const params = steering.paramsOf(sessionId, steer, await this.blocksOf(steer.text, steer.attachments));
      return !Object.isNull(params) && steering.took(JsonReader.fromValue(await this.requestFirst(client, steering.methods, params, null)));
    }
    catch {
      return false;
    }
  }

  private async restartBlocksOf(steers: readonly AcpHeldSteer[]): Promise<JsonValue[]> {
    const blocks = await this.blocksOf(CoreResources.planApprovedPrompt, []);
    for (const held of steers) {
      try {
        blocks.push(...await this.blocksOf(held.steer.text, held.steer.attachments));
      }
      catch {
        held.sent.resolve(false);
      }
    }
    return blocks;
  }

  private async blocksOf(text: string, attachments: readonly MessageAttachment[]): Promise<JsonValue[]> {
    const blocks: JsonValue[] = [{ type: Resources.textInputType, text }];
    for (const attachment of attachments.filter(t => t.isImage))
      blocks.push({ type: Resources.imageInputType, mimeType: attachment.mediaType, data: (await readFile(attachment.path)).toString(Resources.acpBase64Encoding) });
    if (this.agent.sendsResourceLinks) {
      for (const attachment of attachments.filter(t => !t.isImage))
        blocks.push({ type: Resources.acpResourceLinkType, uri: pathToFileURL(attachment.path).href, name: attachment.name,
          mimeType: attachment.mediaType, size: attachment.size });
    }
    return blocks;
  }

  private async requestFirst(client: AcpClient, methods: readonly string[], params: Record<string, JsonValue>,
    timeout: number | null = this.timings.requestTimeout): Promise<JsonValue> {
    let unsupported: unknown = null;
    for (const method of methods) {
      try {
        return await client.request(method, params, timeout);
      }
      catch (error) {
        if (!(error instanceof AcpRequestException) || error.code !== Resources.acpUnsupportedCode)
          throw error;
        unsupported = error;
      }
    }
    throw unsupported;
  }

  private async requestExtension<T>(client: AcpClient, methods: readonly string[], params: Record<string, JsonValue>,
    read: (answer: JsonValue) => T | null, timeout: number | null = null, afterHang: boolean = false): Promise<T | null> {
    for (const method of methods) {
      try {
        return read(await client.request(method, params, timeout ?? this.timings.requestTimeout));
      }
      catch (error) {
        const passed = error instanceof AcpRequestException ? error.code === Resources.acpUnsupportedCode
          : afterHang && error instanceof Error && error.message === Resources.formatAcpTimeout(method);
        if (!passed)
          return null;
      }
    }
    return null;
  }

  private async selectModel(client: AcpClient, sessionId: string, started: JsonReader, resumed: boolean, requested: RequestedSettings,
    observed: ObservedSettings): Promise<ObservedSettings> {
    const state = started.hasField(Resources.acpModelsField) ? started.readNullableObject(Resources.acpModelsField) : null;
    const switched = resumed && !Object.isNull(requested.model) && state?.readOptionalString(Resources.acpCurrentModelField) !== requested.model;
    if (switched)
      await client.request(Resources.acpSessionSetModel, { sessionId, modelId: requested.model });
    const model = switched ? requested.model : state?.readOptionalString(Resources.acpCurrentModelField) ?? null;
    return new ObservedSettings(observed.kind, model, this.agent.readEffort(started), observed.harnessVersion);
  }

  protected checkUnavailableModel(_provider: Provider | null, _model: string): Promise<boolean> | null {
    return null;
  }

  protected reportPlanAfterFailure(_client: AcpClient, _provider: Provider | null, _listener: ITurnListener, _error: unknown): Promise<void> {
    return Promise.resolve();
  }

  protected async reportPlanUsage(client: AcpClient, _provider: Provider | null, listener: ITurnListener, _reply: string): Promise<void> {
    const usage = this.agent.usage;
    if (Object.isNull(usage))
      return;
    const readAt = new Date().toISOString();
    await AcpAdapter.reportPlanAsync(listener, await this.requestExtension(client, usage.planMethods, {}, t => usage.readPlan(t)), readAt);
  }

  protected static async reportPlanAsync(listener: ITurnListener, windows: readonly PlanWindow[] | null, readAt: string): Promise<void> {
    if (!Object.isNull(windows))
      await listener.onPlanUsageAsync(windows, readAt);
  }

  private async awaitTeamRunTools(tools: TurnTools, deadline: Promise<boolean>, wait: AbortController, client: AcpClient, provider: Provider | null,
    startedAt: string): Promise<string | null> {
    const name = this.descriptor.displayName;
    try {
      const missing = await Promise.race([tools.listed.then(() => null),
        tools.failed.then(t => Resources.formatTeamRunToolsFailed(name, FailureDescriber.describe(t))),
        client.processClosed.then(() => Resources.formatTeamRunToolsAgentEnded(name)),
        deadline.then(t => t ? Resources.formatTeamRunToolsTimedOut(name, Resources.teamRunToolsWait) : null)]);
      if (!Object.isNull(missing))
        this.sessionLog?.write(Resources.formatTeamRunToolsUnlisted(this.descriptor.id, missing,
          this.agent.readMcpBlocks?.(provider, startedAt).get(ProtocolResources.mcpServerName) ?? null));
      return missing;
    }
    finally {
      wait.abort();
    }
  }

  private async reportMissingToolsAsync(request: TurnRequest, listener: ITurnListener, initialized: JsonReader, environment: NodeJS.ProcessEnv,
    missing: string | null): Promise<void> {
    const untrusted = this.agent.readUntrustedFolder?.(initialized, environment, request.workingDirectory) ?? null;
    const reason = untrusted ?? this.agent.readMissingTools?.(initialized) ?? missing;
    if (!Object.isNull(reason))
      await listener.onSharedServerFailedAsync(new SharedMcpFailure(request.provider?.id ?? this.descriptor.id, request.provider?.label ?? this.descriptor.displayName,
        ProtocolResources.mcpServerName, Object.isNull(untrusted) ? SharedMcpFailureKind.Unlisted : SharedMcpFailureKind.Untrusted, reason));
  }

  private async reportBlockedServersAsync(request: TurnRequest, listener: ITurnListener, since: string, reported: Set<string>): Promise<void> {
    if (request.sharedServers.length === 0 || Object.isUndefined(this.agent.readMcpBlocks))
      return;
    const blocks = this.agent.readMcpBlocks(request.provider, since);
    try {
      for (const server of request.sharedServers.filter(t => !reported.has(t.name))) {
        const reason = blocks.get(server.name);
        if (Object.isUndefined(reason))
          continue;
        reported.add(server.name);
        await listener.onSharedServerFailedAsync(new SharedMcpFailure(request.provider?.id ?? this.descriptor.id, request.provider?.label ?? this.descriptor.displayName,
          server.name, SharedMcpFailureKind.Blocked, reason));
      }
    }
    catch (error) {
      this.sessionLog?.write(Resources.formatBlockedServersUnnoted(this.descriptor.id, FailureDescriber.describe(error)));
    }
  }

  private async confirm(confirming: Promise<boolean>, signal: AbortSignal): Promise<boolean> {
    const waited = new AbortController();
    try {
      return await Promise.race([confirming, this.timer.delayAsync(Resources.modelCheckWait, AbortSignal.any([signal, waited.signal])).then(() => false, () => false)]);
    }
    finally {
      waited.abort();
    }
  }

  private async listedModels(client: AcpClient, initialized: JsonReader): Promise<readonly ProviderModel[] | null> {
    const modelList = this.agent.modelList;
    return Object.isUndefined(modelList) ? null : await this.requestExtension(client, modelList.methods, {}, t => modelList.read(t, initialized),
      this.timings.modelListTimeout);
  }

  private loaded(models: readonly ProviderModel[]): boolean {
    return models.some(t => !this.agent.fallbackModels.includes(t.id));
  }

  private launchedModel(requested: RequestedSettings): string | null {
    return this.agent.modelAtLaunch ? requested.model : null;
  }

  private unconfirmed(observed: ObservedSettings, requested: RequestedSettings): ObservedSettings {
    return observed.unavailableModel ? new ObservedSettings(observed.kind, this.launchedModel(requested), observed.effort, observed.harnessVersion) : observed;
  }

  private async configure(client: AcpClient, sessionId: string, started: JsonReader, options: readonly AcpConfigOption[], resumed: boolean, provider: Provider | null,
    requested: RequestedSettings, observed: ObservedSettings): Promise<[ObservedSettings, Promise<boolean> | null]> {
    let current = options;
    const model = this.modelOf(current);
    const choices = Object.isUndefined(model) ? null : this.choicesOf(model);
    const shown = resumed && Object.isNull(requested.effort) && !Object.isNull(choices) ? this.shownLevelOf(provider, requested.model) : null;
    const [wanted, takesEffort] = Object.isNull(choices) ? [requested.model, false] : choices.resolve(requested.model, requested.effort ?? shown);
    if (!Object.isNull(wanted) && (Object.isUndefined(model) ? !this.agent.modelAtLaunch : !model.values.includes(wanted)))
      throw new ModelUnavailableException(Resources.formatModelUnavailable(this.descriptor.displayName, wanted));
    if (!Object.isUndefined(model) && !Object.isNull(wanted) && wanted !== model.currentValue)
      current = await this.setOption(client, sessionId, current, model, wanted);
    const chosen = this.modelOf(current);
    const effort = current.find(t => t.category === Resources.acpThoughtLevelCategory);
    const modelName = Object.isUndefined(chosen) ? this.descriptor.displayName : chosen.nameOf(chosen.currentValue);
    const dropped = Object.isUndefined(effort) && options.some(t => t.category === Resources.acpThoughtLevelCategory);
    const level = takesEffort || dropped ? null : requested.effort;
    if (!Object.isNull(level) && (Object.isUndefined(effort) ? !this.agent.effortAtLaunch : !effort.values.includes(level)))
      throw new SettingUnavailableException(Resources.formatUnknownEffort(level, modelName));
    if (!Object.isUndefined(effort) && !Object.isNull(level) && level !== effort.currentValue)
      current = await this.setOption(client, sessionId, current, effort, level);
    const [speeded, speed] = await this.selectSpeed(client, sessionId, current, requested.speed);
    current = speeded;
    current = await this.selectMode(client, sessionId, started, current, resumed, requested);
    const launched = this.agent.effortAtLaunch ? level : null;
    const check = Object.isNull(requested.model) ? null : this.checkUnavailableModel(provider, requested.model);
    const confirming = Object.isUndefined(chosen) ? check : null;
    const unavailable = !Object.isNull(confirming);
    const served = this.modelOf(current)?.currentValue ?? null;
    const family = Object.isNull(served) || Object.isNull(choices) ? null : choices.familyOf(served);
    return [new ObservedSettings(observed.kind, family ?? served ?? (unavailable ? null : this.launchedModel(requested)),
      Object.isNull(family) ? current.find(t => t.category === Resources.acpThoughtLevelCategory)?.currentValue ?? launched : served, observed.harnessVersion,
      unavailable, speed), confirming];
  }

  private async selectSpeed(client: AcpClient, sessionId: string, options: readonly AcpConfigOption[],
    speed: string | null): Promise<[options: readonly AcpConfigOption[], served: string | null]> {
    const speeds = this.agent.speedOption ?? null;
    const option = speeds?.find(options);
    if (Object.isNull(speeds) || Object.isUndefined(option))
      return [options, null];
    const value = Object.isNull(speed) ? null : speeds.valueOf(speed);
    const current = Object.isNull(value) || value === option.currentValue ? options : await this.setOption(client, sessionId, options, option, value);
    return [current, speeds.servedIn(current)];
  }

  private shownLevelOf(provider: Provider | null, model: string | null): string | null {
    const models = this.agent.turnModels?.read(provider) ?? this.listed.get(provider?.id ?? null) ?? [];
    return models.find(t => Object.isNull(model) ? t.isDefault : t.id === model)?.configuredEffort ?? null;
  }

  private async leavePlan(client: AcpClient | null, sessionId: string, asked: TurnRequest, request: TurnRequest): Promise<void> {
    const leaves = this.agent.plans?.leavesPlan === true;
    if (leaves)
      this.sessionModes.set(client, this.agent.defaultMode);
    if (asked === request || Object.isNull(client))
      return;
    const wanted = this.agent.modes.find(t => t.id === asked.requested.mode && t.id !== this.planMode);
    const mode = Object.isUndefined(wanted) || this.runsInDefault(wanted.id) ? this.agent.defaultMode : wanted.id;
    if (Object.isNull(mode) || (leaves && mode === this.agent.defaultMode))
      return;
    await client.request(Resources.acpSessionSetMode, { sessionId, modeId: mode });
    if (leaves)
      this.sessionModes.set(client, mode);
  }

  private async noteWakeModeAsync(client: AcpClient | null, launched: string | null, wake: WakeTurn): Promise<void> {
    const mode = wake.mode ?? this.agent.defaultMode;
    if (!Object.isNull(launched) && launched === this.agent.launchMode && mode !== launched)
      await wake.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatWakeStillApproves(this.descriptor.displayName), null, null));
    if (this.sessionModeOf(wake.mode) !== this.sessionModes.get(client))
      await wake.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatWakeBeganInEarlierMode(this.descriptor.displayName), null, null));
  }

  private switchWakeMode(client: AcpClient | null, sessionId: string | null, wake: WakeTurn): Promise<void> {
    const modeId = this.sessionModeOf(wake.mode);
    let switched = Promise.resolve();
    if (!Object.isNull(client) && !Object.isNull(sessionId) && !Object.isNull(modeId))
      switched = client.request(Resources.acpSessionSetMode, { sessionId, modeId }).then(() => {
        this.sessionModes.set(client, modeId);
      }, (error: unknown) =>
        wake.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatWakeModeKept(this.descriptor.displayName, FailureDescriber.describe(error)), null, null)))
        .catch((error: unknown) => this.sessionLog?.write(Resources.formatWakeModeNoteLost(this.descriptor.id, FailureDescriber.describe(error))));
    return switched;
  }

  private sessionModeOf(mode: string | null): string | null {
    return Object.isNull(mode) || this.runsInDefault(mode) ? this.agent.defaultMode : mode;
  }

  private plannedOf(request: TurnRequest): TurnRequest {
    const requested = request.requested;
    const planMode = this.planMode;
    return requested.planFirst && !Object.isNull(planMode)
      ? request.withRequested(new RequestedSettings(requested.kind, requested.model, requested.effort, requested.speed, planMode, true)) : request;
  }

  private async selectMode(client: AcpClient, sessionId: string, started: JsonReader, options: readonly AcpConfigOption[], resumed: boolean,
    requested: RequestedSettings): Promise<readonly AcpConfigOption[]> {
    const permission = this.agent.permissionSwitch;
    const defaultMode = this.agent.modes.find(t => t.id === this.agent.defaultMode);
    const wanted = this.agent.modes.find(t => t.id === requested.mode) ?? defaultMode;
    const switching = !Object.isNull(permission) && !Object.isUndefined(wanted) && wanted.id === permission.mode;
    const session = !Object.isUndefined(wanted) && this.runsInDefault(wanted.id) ? defaultMode : wanted;
    const chosenUnrestricted = wanted?.unrestricted === true;
    let current = options;
    const option = current.find(t => t.category === Resources.acpModeCategory);
    const modes = started.hasField(Resources.acpModesField) ? started.readNullableObject(Resources.acpModesField) : null;
    const listed = Object.isUndefined(option) ? modes?.readObjectArray(Resources.acpAvailableModesField).map(t => t.readNonBlankString(Resources.idField)) ?? []
      : option.values;
    const unlisted = Object.isUndefined(option) && Object.isNull(modes) && this.agent.takesUnlistedModes === true;
    const offered = unlisted ? this.agent.modes.map(t => t.id) : listed;
    const assumed = resumed ? null : this.agent.defaultMode;
    let mode = unlisted ? assumed : Object.isUndefined(option) ? modes?.readOptionalString(Resources.acpCurrentModeField) ?? null : option.currentValue;
    if (!Object.isUndefined(session) && offered.includes(session.id)) {
      if (!Object.isUndefined(option) && session.id !== option.currentValue)
        current = await this.setOption(client, sessionId, current, option, session.id);
      else if (Object.isUndefined(option) && session.id !== mode)
        await client.request(Resources.acpSessionSetMode, { sessionId, modeId: session.id });
      mode = current.find(t => t.category === Resources.acpModeCategory)?.currentValue ?? session.id;
      this.sessionModes.set(client, session.id);
    }
    else if (!Object.isUndefined(session) && session.id !== this.agent.defaultMode)
      throw new SettingUnavailableException(Resources.formatModeUnavailable(this.descriptor.displayName, session.name));
    current = chosenUnrestricted && !switching ? current : await this.setSwitch(client, sessionId, current, switching, wanted);
    const switched = !Object.isNull(permission) && current.some(t => t.id === permission.optionId && t.currentValue === permission.onValue) ? permission.mode : null;
    const unrestricted = chosenUnrestricted ? undefined : this.agent.modes.find(t => t.unrestricted && (t.id === mode || t.id === switched));
    if (!Object.isUndefined(unrestricted))
      throw new SettingUnavailableException(Resources.formatUnrestrictedMode(this.descriptor.displayName, unrestricted.name));
    return current;
  }

  private runsInDefault(mode: string): boolean {
    return mode === this.agent.launchMode || mode === this.agent.permissionSwitch?.mode || mode === this.agent.allowAllMode;
  }

  private async setSwitch(client: AcpClient, sessionId: string, options: readonly AcpConfigOption[], on: boolean,
    wanted: ProviderMode | undefined): Promise<readonly AcpConfigOption[]> {
    const permission = this.agent.permissionSwitch;
    if (Object.isNull(permission))
      return options;
    const value = on ? permission.onValue : permission.offValue;
    const option = options.find(t => t.id === permission.optionId);
    if (on && (Object.isUndefined(option) || !option.values.includes(value)))
      throw new SettingUnavailableException(Resources.formatModeUnavailable(this.descriptor.displayName, wanted!.name));
    return Object.isUndefined(option) || option.currentValue === value || !option.values.includes(value) ? options
      : await this.setOption(client, sessionId, options, option, value);
  }

  private async setOption(client: AcpClient, sessionId: string, options: readonly AcpConfigOption[], option: AcpConfigOption,
    value: string): Promise<readonly AcpConfigOption[]> {
    const answer = await client.request(Resources.acpSessionSetConfigOption, { sessionId, configId: option.id, value });
    return AcpConfigOption.readAll(JsonReader.fromValue(answer)) ?? options.map(t => t === option ? t.withValue(value) : t);
  }

  private async createClient(provider: Provider | null, requested: RequestedSettings | null, signingIn: boolean = false,
    environment: Readonly<Record<string, string>> = {}, workingDirectory: string | null = null, approvedTools: readonly string[] | null = null,
    shutdowns: number = this.shutdowns, extraArguments: readonly string[] = [], chatTurn: boolean = false,
    titleSession: boolean = false): Promise<LaunchedAcpClient> {
    const base = await this.starter.readEnvironmentAsync(this.agent.baseEnvironment);
    if (shutdowns !== this.shutdowns)
      throw new ProviderStoppedException(Resources.formatStoppedForShutdown(this.descriptor.displayName));
    if (this.signingOut.has(provider?.id ?? null))
      throw new SignOutException(Resources.formatSigningOut(this.descriptor.displayName));
    return this.launchClient(provider, requested, base, signingIn, environment, workingDirectory, approvedTools, extraArguments, chatTurn, titleSession);
  }

  private launchClient(provider: Provider | null, requested: RequestedSettings | null, base: NodeJS.ProcessEnv, signingIn: boolean = false,
    environment: Readonly<Record<string, string>> = {}, workingDirectory: string | null = null, approvedTools: readonly string[] | null = null,
    extraArguments: readonly string[] = [], chatTurn: boolean = false, titleSession: boolean = false): LaunchedAcpClient {
    const launch = this.agent.launch(provider, requested, workingDirectory, approvedTools, base, chatTurn, titleSession);
    if (!signingIn && this.agent.isSignedIn(provider) === false)
      throw new SignInException(this.agent.formatSignIn(provider));
    const command = launch.command.withArguments(...extraArguments).withOrigin(this.originOf(provider)).inOwnGroup();
    const launched = signingIn ? AcpEnvironment.forSignIn(launch.environment, base) : launch.environment;
    const client = new AcpClient(command, { ...launched, ...environment }, launch.directory, this.starter, this.timings, this.timer, MessageFraming.Lines,
      this.processTree, this.agent.toolGate ?? null);
    this.clients.set(client, provider?.id ?? null);
    client.start();
    return new LaunchedAcpClient(client, base);
  }

  private async initializeSignedIn(client: AcpClient): Promise<JsonReader | null> {
    try {
      return await this.initialize(client);
    }
    catch (error) {
      if (this.isAuthRequired(error))
        return null;
      throw error;
    }
  }

  private async initialize(client: AcpClient): Promise<JsonReader> {
    const initialized = await this.requestInitialize(client);
    const unsupported = this.agent.formatUnsupported(this.agent.readVersion(initialized));
    if (!Object.isNull(unsupported))
      throw new UnsupportedVersionException(unsupported);
    return initialized;
  }

  private async requestInitialize(client: AcpClient): Promise<JsonReader> {
    return JsonReader.fromValue(await client.request(Resources.acpInitialize, {
      protocolVersion: 1, clientInfo: { name: this.clientInfo.name, version: this.clientInfo.version },
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: this.agent.runsTerminals === true, session: { compaction: {} }, elicitation: { form: {} },
        ...Object.isNull(this.agent.initializeMeta) ? {} : { [Resources.acpMetaField]: this.agent.initializeMeta } }
    }, this.timings.initializeTimeout).catch((error: unknown) => {
      throw error instanceof AcpRequestException && this.agent.isSignedOutRefusal?.(error.code, error.message) === true
        ? new AcpRequestException(error.message, Resources.acpAuthRequiredCode, error.data) : error;
    }));
  }

  private serversOf(request: TurnRequest, initialized: JsonReader, endpoint: AcpServedEndpoint | null,
    environment: NodeJS.ProcessEnv): JsonValue[] {
    const shared = request.sharedServers.map(t => this.sharedServerOf(t, initialized,
      (variable: string) => request.sharedValues.valueOf(t.name, variable) ?? environment[variable] ?? String.empty));
    if (!Object.isNull(endpoint)) {
      return [...shared, {
        type: Resources.acpHttpServerType,
        name: ProtocolResources.mcpServerName,
        url: endpoint.url,
        headers: [{ name: Resources.authorizationHeader, value: Resources.formatBearerValue(endpoint.token) }]
      }];
    }
    return shared;
  }

  private endpointOf(tools: TurnTools | null, initialized: JsonReader): McpEndpoint | null {
    if (Object.isNull(tools))
      return null;
    if (!AcpAdapter.takesHttpServers(initialized))
      throw new ToolsUnavailableException(Resources.formatAcpToolsNeedHttp(this.descriptor.displayName));
    if (Object.isNull(tools.endpoint))
      throw new ToolsUnavailableException(Resources.formatToolsNotServed(this.descriptor.displayName));
    return tools.endpoint;
  }

  private sharedServerOf(server: SharedMcpServerDefinition, initialized: JsonReader, valueOf: (variable: string) => string): JsonValue {
    const command = server.command;
    if (!Object.isNull(command))
      return { name: server.name, command: AcpAdapter.launch.program, args: AcpAdapter.launch.argumentsOf(command, server.arguments, server.variables),
        env: Object.entries(AcpAdapter.launch.environmentOf(Object.fromEntries(server.variables.map(t => [t, valueOf(t)]))))
          .map(([name, value]) => ({ name, value })) };
    if (!AcpAdapter.takesHttpServers(initialized))
      throw new ToolsUnavailableException(Resources.formatAcpHttpServerUnsupported(this.descriptor.displayName, server.name));
    const headers = server.headers.map(t => ({ name: t.name, value: valueOf(t.variable) }));
    return {
      type: Resources.acpHttpServerType,
      name: server.name,
      url: server.url!,
      headers: Object.isNull(server.bearerVariable) ? headers
        : [...headers, { name: Resources.authorizationHeader, value: Resources.formatBearerValue(valueOf(server.bearerVariable)) }]
    };
  }

  private needsNoSignIn(provider: Provider, initialized: JsonReader): boolean {
    const methods = initialized.hasField(Resources.acpAuthMethodsField) ? initialized.readObjectArray(Resources.acpAuthMethodsField) : [];
    return !this.agent.authenticates && methods.length === 0 && Object.isNull(this.agent.isSignedIn(provider))
      && Object.isNull(this.agent.descriptor.profile?.signInCommand ?? null);
  }

  private canAuthenticate(initialized: JsonReader): boolean {
    return initialized.readObjectArray(Resources.acpAuthMethodsField).some(t => t.readNonBlankString(Resources.idField) === this.agent.authMethod);
  }

  private async startSession(client: AcpClient): Promise<JsonReader | null> {
    try {
      return JsonReader.fromValue(await client.request(Resources.acpSessionNew, { cwd: client.directory, mcpServers: [] }, this.timings.initializeTimeout));
    }
    catch (error) {
      if (this.isAuthRequired(error))
        return null;
      throw error;
    }
  }

  private async probeSession(client: AcpClient, initialized: JsonReader): Promise<JsonReader | null> {
    const session = await this.startSession(client);
    if (!Object.isNull(session))
      this.agent.readSession?.(session);
    const sessionId = session?.readOptionalString(Resources.sessionIdField) ?? null;
    if (!Object.isNull(sessionId) && AcpAdapter.canClose(initialized))
      await client.request(Resources.acpSessionClose, { [Resources.sessionIdField]: sessionId }, this.timings.stopGrace).catch(() => null);
    return session;
  }

  private optionModels(initialized: JsonReader, session: JsonReader): readonly ProviderModel[] {
    const options = AcpConfigOption.readAll(session) ?? [];
    const option = this.modelOf(options);
    const levels = options.find(t => t.category === Resources.acpThoughtLevelCategory);
    return Object.isUndefined(option) ? [] : this.withSpeeds(this.choicesOf(option).models(AcpAdapter.takesImages(initialized), levels), options);
  }

  private withSpeeds(models: readonly ProviderModel[], options: readonly AcpConfigOption[]): readonly ProviderModel[] {
    const speeds = this.agent.speedOption ?? null;
    const option = speeds?.find(options);
    if (Object.isNull(speeds) || Object.isUndefined(option))
      return models;
    const current = speeds.speedOf(option.currentValue);
    return models.map(t => new ProviderModel(t.id, t.displayName, t.description, t.effortLevels, t.isDefault, t.resolvedModel, t.supportsImages, t.defaultEffort,
      t.effortNames, speeds.speeds, current, t.contextWindows, t.unavailableReason, t.configuredEffort));
  }

  private async withListedLevels(provider: Provider | null, environment: NodeJS.ProcessEnv, models: readonly ProviderModel[]): Promise<readonly ProviderModel[]> {
    const reader = this.agent.levels;
    if (Object.isUndefined(reader))
      return models;
    const launch = reader.launch(provider, environment);
    const result = await new CommandRunner(this.starter, Resources.levelListOutputLength).run(launch.command.withOrigin(this.originOf(provider)),
      launch.environment, this.timings.requestTimeout).catch(() => null);
    if (Object.isNull(result) || !result.succeeded)
      return models;
    const levels = reader.read(result.stdout);
    return models.map(t => AcpAdapter.withLevels(t, levels.get(t.id)));
  }

  private originOf(provider: Provider | null): ProcessOrigin {
    return new ProcessOrigin(this.descriptor.id, provider?.id ?? null);
  }

  private static withLevels(model: ProviderModel, levels: readonly string[] | undefined): ProviderModel {
    return Object.isUndefined(levels) ? model
      : new ProviderModel(model.id, model.displayName, model.description, levels, model.isDefault, model.resolvedModel, model.supportsImages, levels[0] ?? null);
  }

  private modelOf(options: readonly AcpConfigOption[]): AcpConfigOption | undefined {
    const id = this.agent.modelOption;
    return options.find(t => t.category === Resources.acpModelCategory && (Object.isNullOrUndefined(id) || t.id === id));
  }

  private choicesOf(option: AcpConfigOption): AcpModelChoices {
    return new AcpModelChoices(option, (value, name) => this.agent.memberOf(value, name));
  }

  private logOptions(options: readonly AcpConfigOption[]): void {
    const shown = options.filter(t => t.category === Resources.acpModelCategory || t.category === Resources.acpThoughtLevelCategory);
    this.sessionLog?.write(Resources.formatAcpModelOptions(this.descriptor.id, JSON.stringify(shown.map(t => t.toLog()))));
  }

  private keepModels(provider: Provider | null, initialized: JsonReader, session: JsonReader): void {
    const turnModels = this.agent.turnModels;
    if (Object.isNull(turnModels))
      return;
    const models = this.optionModels(initialized, session);
    try {
      if (models.length > 0)
        turnModels.keep(provider, models);
    }
    catch {
      return;
    }
  }

  private async authenticate(client: AcpClient): Promise<void> {
    if (!this.agent.authenticates)
      return;
    const params: Record<string, JsonValue> = { methodId: this.agent.authMethod };
    if (!Object.isNull(this.agent.authMeta))
      params[Resources.acpMetaField] = this.agent.authMeta;
    await client.request(Resources.acpAuthenticate, params, this.timings.signInCheckTimeout);
  }

  private async stopRunning(provider: Provider): Promise<void> {
    const running = [...this.clients].filter(t => t[1] === provider.id).map(t => t[0]);
    for (const stopped of running)
      this.stoppedForSignOut.add(stopped);
    await Promise.all(running.map(t => this.close(t)));
  }

  private async logOut(provider: Provider): Promise<void> {
    this.signingOut.add(provider.id);
    try {
      await this.stopRunning(provider);
      const { client } = this.launchClient(provider, null, await this.starter.readEnvironmentAsync(this.agent.baseEnvironment));
      try {
        await this.requestLogout(client);
      }
      finally {
        await this.close(client);
      }
      this.agent.forgetSignIn?.(provider);
    }
    finally {
      this.signingOut.delete(provider.id);
    }
  }

  private async requestLogout(client: AcpClient): Promise<void> {
    const initialized = await this.initialize(client).catch((error: unknown) => {
      throw this.signOutTimeout(error, Resources.acpInitialize, this.timings.initializeTimeout);
    });
    const capabilities = AcpAdapter.capabilities(initialized);
    const auth = capabilities?.hasField(Resources.acpAuthField) === true ? capabilities.readNullableObject(Resources.acpAuthField) : null;
    if (auth?.hasField(Resources.acpLogoutField) !== true || Object.isNull(auth.toJson()[Resources.acpLogoutField]))
      throw new SignOutException(Resources.formatAcpLogoutUnsupported(this.descriptor.displayName, this.agent.readVersion(initialized)));
    await client.request(Resources.acpLogout, {}, this.timings.signInCheckTimeout).catch((error: unknown) => {
      throw this.signOutTimeout(error, Resources.acpLogout, this.timings.signInCheckTimeout);
    });
  }

  private signOutTimeout(error: unknown, method: string, milliseconds: number): unknown {
    return error instanceof Error && error.message === Resources.formatAcpTimeout(method)
      ? new TimeoutException(Resources.formatAcpSignOutTimedOut(this.descriptor.displayName, milliseconds)) : error;
  }

  private async release(client: AcpClient, channel: AcpChannel, shutdowns: number, revoke: () => void, keeping: AcpKeptSession | null,
    sessionId: string | null): Promise<void> {
    for (const older of [...this.kept.values()].filter(t => t.sessionId === sessionId))
      older.retire();
    let closing = false;
    if (!Object.isNull(sessionId)) {
      this.runningSessions.delete(sessionId);
      closing = this.closingSessions.delete(sessionId);
    }
    await channel.releaseAsync();
    if (Object.isNull(keeping) && channel.isIdle || !client.isConnected || shutdowns !== this.shutdowns) {
      await this.close(client).finally(revoke);
      return;
    }
    if (!Object.isNull(keeping)) {
      this.kept.set(client, keeping);
      keeping.hold();
      if (closing)
        keeping.retire();
      return;
    }
    const closeQuietly = (): Promise<void> => this.closeQuietly(client);
    void channel.whenIdle().then(closeQuietly, closeQuietly).finally(revoke);
  }

  private static keyOf(request: TurnRequest, approvedTools: readonly string[], tools: readonly string[] | null): string {
    const environment = Object.entries(request.environment).filter(([name]) => name !== ProtocolResources.senderTokenVariable);
    return JSON.stringify([request.provider?.id ?? null, request.provider?.profileDir ?? null, request.provider?.binaryPath ?? null, request.requested.toJson(),
      request.workingDirectory, approvedTools, tools, environment]);
  }

  private async take(key: string | null, request: TurnRequest, sender: string | null): Promise<AcpKeptSession | null> {
    const kept = Object.isNull(key) ? undefined : [...this.kept.values()].find(t => t.sessionId === request.resumeNativeSessionId && t.isIdle && !t.isRetired);
    if (Object.isUndefined(kept))
      return null;
    this.kept.delete(kept.client);
    kept.end();
    try {
      if (await this.fits(kept, key, request, sender))
        return kept;
    }
    catch (error) {
      kept.revoke();
      await this.closeQuietly(kept.client);
      throw error;
    }
    kept.revoke();
    await this.close(kept.client);
    return null;
  }

  private async fits(kept: AcpKeptSession, key: string | null, request: TurnRequest, sender: string | null): Promise<boolean> {
    const endpoint = Object.isNull(kept.token) ? null : this.endpointOf(request.tools, kept.initialized);
    const served = Object.isNull(endpoint) || Object.isNull(kept.token) ? null : new AcpServedEndpoint(endpoint.url, kept.token);
    return kept.key === key && kept.client.isConnected && Object.isNull(request.tools) === Object.isNull(kept.token) && Object.isNull(sender) === Object.isNull(kept.sender)
      && (Object.isNull(kept.sender) || request.adoptSender(kept.sender)) && (Object.isNull(kept.token) || request.tools?.adopt(kept.token) === true)
      && JSON.stringify(await this.paramsOf(request, kept.initialized, served)) === kept.params;
  }

  private async paramsOf(request: TurnRequest, initialized: JsonReader, served: AcpServedEndpoint | null): Promise<Record<string, JsonValue>> {
    const params: Record<string, JsonValue> = { cwd: request.workingDirectory, mcpServers: this.serversOf(request, initialized, served,
      await this.starter.readEnvironmentAsync(this.agent.baseEnvironment)) };
    const meta = { ...this.agent.sessionMeta(request.requested) ?? {}, ...this.agent.toolGate?.metaOf(initialized) ?? {} };
    if (Object.keys(meta).length > 0)
      params[Resources.acpMetaField] = meta;
    return params;
  }

  private async stopKept(kept: AcpKeptSession): Promise<void> {
    await kept.stopTasks();
    await this.closeQuietly(kept.client);
  }

  private closeQuietly(client: AcpClient): Promise<void> {
    return this.close(client).catch(() => undefined);
  }

  private wakeResult(reason: string, sessionId: string, observed: ObservedSettings): TurnResult {
    if (reason === Resources.acpCancelled)
      return new TurnResult(TurnOutcome.Interrupted, sessionId, observed, null);
    return reason === Resources.acpEndTurn || this.agent.stopReasons.includes(reason) ? new TurnResult(TurnOutcome.Completed, sessionId, observed, null)
      : new TurnResult(TurnOutcome.Failed, sessionId, observed, this.agent.formatStopped(reason));
  }

  private async endTaskTree(client: AcpClient, processId: number, startedBy: number): Promise<void> {
    const agentId = client.processId;
    if ((Object.isNull(agentId) || !await this.processTree.endTree(processId, startedBy, agentId)) && !client.isStopping)
      throw new TaskException(Resources.formatTaskProcessGone(this.descriptor.displayName));
  }

  private async cancelSubAgent(client: AcpClient, subAgentId: string): Promise<boolean> {
    const answer = await this.requestFirst(client, Resources.xaiSubAgentCancelMethods, { [Resources.xaiSubAgentIdParam]: subAgentId });
    return UsageValues.fieldOf(answer, Resources.resultField, Resources.xaiCancelledField) === true;
  }

  private async close(client: AcpClient): Promise<void> {
    this.sessionModes.delete(client);
    const kept = this.kept.get(client);
    if (!Object.isUndefined(kept)) {
      this.kept.delete(client);
      kept.end();
      kept.revoke();
    }
    const channel = this.channels.get(client);
    this.channels.delete(client);
    try {
      await client.stop();
    }
    finally {
      await channel?.endAsync();
    }
    this.clients.delete(client);
  }

  private isAuthRequired(error: unknown): boolean {
    return error instanceof AcpRequestException && (error.code === Resources.acpAuthRequiredCode || this.agent.isSignedOutRefusal?.(error.code, error.message) === true);
  }

  private static takesImages(initialized: JsonReader): boolean {
    const capabilities = AcpAdapter.capabilities(initialized);
    const prompt = capabilities?.hasField(Resources.acpPromptCapabilitiesField) === true
      ? capabilities.readNullableObject(Resources.acpPromptCapabilitiesField) : null;
    return prompt?.toJson()[Resources.acpImageCapabilityField] === true;
  }

  private static takesHttpServers(initialized: JsonReader): boolean {
    const capabilities = AcpAdapter.capabilities(initialized);
    const mcp = capabilities?.hasField(Resources.acpMcpCapabilitiesField) === true
      ? capabilities.readNullableObject(Resources.acpMcpCapabilitiesField) : null;
    return mcp?.toJson()[Resources.acpHttpCapabilityField] === true;
  }

  private static canResume(initialized: JsonReader): boolean {
    return AcpAdapter.offersSession(initialized, Resources.acpResumeCapabilityField);
  }

  private static canClose(initialized: JsonReader): boolean {
    return AcpAdapter.offersSession(initialized, Resources.acpCloseCapabilityField);
  }

  private static offersSession(initialized: JsonReader, capability: string): boolean {
    const capabilities = AcpAdapter.capabilities(initialized);
    const session = capabilities?.hasField(Resources.acpSessionCapabilitiesField) === true
      ? capabilities.readNullableObject(Resources.acpSessionCapabilitiesField) : null;
    return session?.hasField(capability) === true && !Object.isNull(session.toJson()[capability]);
  }

  private static capabilities(initialized: JsonReader): JsonReader | null {
    return initialized.hasField(Resources.acpCapabilitiesField) ? initialized.readNullableObject(Resources.acpCapabilitiesField) : null;
  }
}
