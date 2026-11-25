/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync } from "node:fs";
import { homedir } from "node:os";

import "@noldova/context.core";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";
import {
  Resources as CoreResources,
  type ForkRequest,
  type ILog,
  type IProviderAdapter,
  type IProviderKindInstallation,
  type ISignInListener,
  type ITimer,
  type ITurnListener,
  type McpEndpoint,
  NodeTimer,
  PlanReading,
  ProfileSearch,
  SessionCarry,
  SharedMcpRefusal,
  SignInCheck,
  TurnDetail,
  type TurnRequest,
  TurnOutcome,
  TurnResult,
  TurnStart,
  type TurnSteer,
  type TurnTools,
  type TurnWake,
  type WakeTurn
} from "@noldova/teamrun.core";
import { RoleApplication,
  AuthStatus,
  DetailKind,
  ForkedSession,
  ObservedSettings,
  OwnMcpServer,
  OwnMcpServerState,
  type Provider,
  ProviderKind,
  ProviderMode,
  ProviderContextWindows,
  ProviderModel,
  ProviderModelList,
  ProviderProfile,
  RequestedSettings,
  Resources as ProtocolResources,
  type MessageAttachment,
  SenderEnvironment,
  type SharedMcpServerDefinition
} from "@noldova/teamrun.protocol";

import { ExecutableNotFoundException } from "../../exceptions/executable-not-found.exception.js";
import { ModelListException } from "../../exceptions/model-list.exception.js";
import { ProviderStoppedException } from "../../exceptions/provider-stopped.exception.js";
import { SignInException } from "../../exceptions/sign-in.exception.js";
import type { ICodexHold } from "../../interfaces/i-codex-hold.js";
import type { IExitHandler } from "../../interfaces/i-exit-handler.js";
import type { IOrphanSweep } from "../../interfaces/i-orphan-sweep.js";
import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import type { AppServerClientInfo } from "../../models/app-server-client-info.js";
import { CodexAccount } from "../../models/codex-account.js";
import { CodexServerChoice } from "../../models/codex-server-choice.js";
import { CommandSource } from "../../models/command-source.js";
import type { ProcessCommand } from "../../models/process-command.js";
import { ProcessOrigin } from "../../models/process-origin.js";
import { ProviderAbilityTable } from "../../models/provider-ability-table.js";
import type { ProviderTimings } from "../../models/provider-timings.js";
import { ThreadStartResult } from "../../models/thread-start-result.js";
import { Resources } from "../../resources.js";
import { CommandRefusal } from "../command-refusal.js";
import type { ExecutableVersionReader } from "../executables/executable-version.reader.js";
import { FailureDescriber } from "../failure-describer.js";
import { SessionFileCarry } from "../session-file-carry.js";
import { UsualFolder } from "../usual-folder.js";
import { ServedToolNames } from "../mcp/served-tool-names.js";
import { SharedMcpLaunch } from "../mcp/shared-mcp-launch.js";
import { AbortTimer } from "../process/abort-timer.js";
import { CommandRunner } from "../process/command-runner.js";
import { PowershellSession } from "../process/powershell-session.js";
import { ProcessTree } from "../process/process-tree.js";
import { AppServerClient } from "./app-server-client.js";
import { CodexActivity } from "./codex-activity.js";
import { CodexAppServerProgram } from "./codex-app-server-program.js";
import { CodexCommand } from "./codex-command.js";
import { CodexCompactionReader } from "./codex-compaction.reader.js";
import { CodexEnvironment } from "./codex-environment.js";
import { CodexItemReader } from "./codex-item.reader.js";
import { CodexLogin } from "./codex-login.js";
import { CodexRequestRouter } from "./codex-request-router.js";
import { Deadline } from "../deadline.js";
import { DeltaStream } from "../delta-stream.js";
import { CodexSubAgents } from "./codex-sub-agents.js";
import { CodexSessionFile } from "./codex-session-file.js";
import { CodexTasks } from "./codex-tasks.js";
import { CodexTurn } from "./codex-turn.js";
import { CodexModelDefaults } from "./codex-model-defaults.js";
import { CodexModelReader } from "./codex-model.reader.js";
import { CodexRateLimits } from "./codex-rate-limits.js";
import { CodexUsage } from "./codex-usage.js";
import { CodexSharedServerStatuses } from "./codex-shared-server-statuses.js";
import { TokenTotals } from "../../models/token-totals.js";

export class CodexAdapter implements IProviderAdapter {
  private static readonly launch: SharedMcpLaunch = new SharedMcpLaunch();
  private static readonly modes: readonly ProviderMode[] = [
    new ProviderMode(Resources.codexReadOnlyMode, Resources.codexReadOnlyModeName, Resources.codexReadOnlyModeDescription, false, true),
    new ProviderMode(Resources.codexDefaultMode, Resources.codexDefaultModeName, Resources.codexDefaultModeDescription),
    new ProviderMode(Resources.codexFullAccessMode, Resources.codexFullAccessModeName, Resources.codexFullAccessModeDescription, true),
    new ProviderMode(Resources.codexPlanMode, Resources.codexPlanModeName, Resources.codexPlanModeDescription, false, true)];
  private static readonly sandboxes: Readonly<Record<string, readonly [string, string]>> = {
    [Resources.codexReadOnlyMode]: [Resources.readOnlySandbox, Resources.onRequestApprovalPolicy],
    [Resources.codexDefaultMode]: [Resources.workspaceWriteSandbox, Resources.onRequestApprovalPolicy],
    [Resources.codexFullAccessMode]: [Resources.dangerFullAccessSandbox, Resources.neverApprovalPolicy],
    [Resources.codexPlanMode]: [Resources.readOnlySandbox, Resources.onRequestApprovalPolicy]
  };
  public readonly descriptor: ProviderKind;
  public readonly takesTeamRunTools: boolean = true;
  public readonly profileSearch: ProfileSearch;
  public readonly modes: readonly ProviderMode[] = CodexAdapter.modes;
  public readonly defaultMode: string = Resources.codexDefaultMode;
  public readonly explorerUnavailable: string = Resources.codexExplorerUnavailable;
  public readonly planMode: string = Resources.codexPlanMode;
  public readonly installation?: IProviderKindInstallation;
  private readonly commands: CommandSource;
  private readonly baseEnvironment: NodeJS.ProcessEnv;
  private readonly clientInfo: AppServerClientInfo;
  private readonly starter: IProcessStarter;
  private readonly timings: ProviderTimings;
  private readonly versionReader: ExecutableVersionReader;
  private readonly serverProgram: CodexAppServerProgram | null;
  private readonly log: ILog | null;
  private readonly platform: string;
  private readonly sweep: IOrphanSweep;
  private readonly router: CodexRequestRouter = new CodexRequestRouter();
  private readonly itemReader: CodexItemReader = new CodexItemReader();
  private readonly clients: Map<string, Promise<AppServerClient>> = new Map();
  private readonly keepingOwnServers: WeakSet<Promise<AppServerClient>> = new WeakSet();
  private readonly totals: Map<string, TokenTotals> = new Map();
  private readonly reportedWindows: Map<string, number> = new Map();
  private readonly planningThreads: Set<string> = new Set();
  private readonly rateLimits: WeakMap<AppServerClient, CodexRateLimits> = new WeakMap();
  private readonly holds: WeakMap<AppServerClient, Map<string, ICodexHold>> = new WeakMap();
  private readonly starting: Set<AppServerClient> = new Set();
  private readonly taskLists: Set<CodexTasks | CodexSubAgents> = new Set();
  private readonly childThreads: Map<string, Map<string, JsonObject>> = new Map();
  private readonly turnStarts: Map<string, number> = new Map();
  private readonly threadLocks: Map<string, Promise<void>> = new Map();
  private readonly turnEnds: Map<CodexTurn, (() => Promise<void>)[]> = new Map();
  private readonly leased: AppServerClient[] = [];
  private readonly retired: Set<AppServerClient> = new Set();
  private readonly checks: WeakMap<AppServerClient, { stamp: string | null; done: Promise<void>; retryAt: number }> = new WeakMap();
  private readonly reading: Set<Promise<void>> = new Set();
  private readonly stopping: AbortController = new AbortController();
  private readonly timer: ITimer;
  private readonly idleTimer: ITimer;
  private readonly idle: Map<AppServerClient, Deadline> = new Map();
  private readonly silences: Map<Deadline, string> = new Map();
  private readonly kept: Map<Deadline, { readonly threadId: string; readonly held: ICodexHold; readonly resolve: () => void }> = new Map();
  private readonly releases: Set<{ readonly threadId: string; readonly done: PromiseWithResolvers<void> }> = new Set();
  private readonly closing: Set<string> = new Set();
  private stopped: boolean = false;

  public constructor(
    command: ProcessCommand | null,
    baseEnvironment: NodeJS.ProcessEnv,
    clientInfo: AppServerClientInfo,
    starter: IProcessStarter,
    timings: ProviderTimings,
    versionReader: ExecutableVersionReader,
    timer: ITimer = new NodeTimer(),
    locate: () => ProcessCommand | null = CommandSource.none,
    installation: IProviderKindInstallation | null = null,
    log: ILog | null = null,
    platform: string = process.platform,
    sweep: IOrphanSweep = new ProcessTree(platform, new CommandRunner(starter), process.env, Resources.processListTimeout, timer, timings.stopGrace, undefined,
      PowershellSession.shared, undefined, log),
    idleTimer: ITimer = new NodeTimer(),
    serverProgram: CodexAppServerProgram | null = null) {
    this.log = log;
    this.serverProgram = serverProgram;
    this.idleTimer = idleTimer;
    this.platform = platform;
    this.sweep = sweep;
    this.timer = timer;
    this.versionReader = versionReader;
    this.descriptor = new ProviderKind(Resources.codexKindId, Resources.codexDisplayName, true, true, null,
      new ProviderProfile(Resources.codexHomeVariable, null, UsualFolder.of(baseEnvironment, Resources.codexHomeVariable, Resources.codexHomeFolderName)),
      true, null, false, null, true, Resources.codexOwnMcpServersNote, ProviderAbilityTable.codex, false, false, undefined,
      Resources.codexOwnMcpServersShortNote, false, true, true, true);
    this.profileSearch = new ProfileSearch(UsualFolder.places(baseEnvironment, Resources.codexHomeVariable, Resources.codexHomeFolderName),
      Resources.codexProfileEntries);
    this.commands = new CommandSource(command, locate);
    if (!Object.isNull(installation))
      this.installation = installation;
    this.baseEnvironment = baseEnvironment;
    this.clientInfo = clientInfo;
    this.starter = starter;
    this.timings = timings;
  }

  public get clientCount(): number {
    return this.clients.size + this.retired.size;
  }

  public async checkSignIn(provider: Provider): Promise<SignInCheck> {
    try {
      return await this.useClient(provider, async client => {
        const codexAccount = await this.readAccount(client);
        if (Object.isNull(codexAccount))
          return new SignInCheck(AuthStatus.LoggedOut, null, client.version, null);

        return new SignInCheck(AuthStatus.LoggedIn, codexAccount.toIdentity(), client.version, null);
      });
    }
    catch (error) {
      return new SignInCheck(AuthStatus.Error, null, null, FailureDescriber.describe(error));
    }
  }

  public async checkFoundSignIn(provider: Provider): Promise<SignInCheck> {
    const command = this.commands.current;
    if (Object.isNull(command))
      return new SignInCheck(AuthStatus.Error, null, null, Resources.codexNotFound);
    const environment = CodexEnvironment.build(await this.starter.readEnvironmentAsync(this.baseEnvironment), provider.profileDir);
    const result = await new CommandRunner(this.starter).run(command.withArguments(...Resources.codexLoginStatusArguments).withOrigin(this.originOf(provider)),
      environment, this.timings.signInCheckTimeout);
    if (result.exitCode === 0)
      return new SignInCheck(AuthStatus.LoggedIn, null, null, null);
    return new SignInCheck(result.exitCode === 1 && !result.timedOut ? AuthStatus.LoggedOut : AuthStatus.Error, null, null, null);
  }

  public async listModels(provider: Provider | null, _refresh: boolean = false, workingDirectory: string | null = null): Promise<ProviderModelList> {
    return this.useClient(provider, async client => {
      const [models, defaults] = await this.readCatalog(client, workingDirectory,
        t => CodexAdapter.withWindows(t, this.reportedWindows.get(CodexAdapter.windowKey(provider, t.id)) ?? null));
      return new ProviderModelList(models, await this.readSignedIn(client), false, null, false, CodexAdapter.modes, Resources.codexDefaultMode,
        false, null, Object.isNull(defaults));
    });
  }

  private async readCatalog(client: AppServerClient, workingDirectory: string | null,
    map: (model: ProviderModel) => ProviderModel = t => t): Promise<readonly [readonly ProviderModel[], CodexModelDefaults | null]> {
    const models = (await this.readModels(client)).map(map);
    const defaults = await this.readModelDefaults(client, workingDirectory);
    return [defaults?.applyTo(models) ?? models, defaults];
  }

  public async signIn(provider: Provider, signal: AbortSignal, listener: ISignInListener): Promise<void> {
    const check = this.checkCurrent(provider);
    if (!Object.isNull(check))
      await CodexAdapter.waitUnlessAborted(check, signal);
    CodexAdapter.throwIfAborted(signal);
    const client = await CodexAdapter.untilAborted(this.connect(provider), signal);
    await this.useLeased(client, () => this.signInOn(client, signal, listener));
  }

  public async signOut(provider: Provider): Promise<void> {
    await this.useClient(provider, client => client.request(Resources.logoutMethod, null, this.timings.requestTimeout));
  }

  private async signInOn(client: AppServerClient, signal: AbortSignal, listener: ISignInListener): Promise<void> {
    if (!Object.isNull(await CodexAdapter.untilAborted(this.readAccount(client), signal)))
      return;
    CodexAdapter.throwIfAborted(signal);
    const login = new CodexLogin(client, this.timings.abortGrace);
    const notifications = client.subscribe(login);
    const exits = client.subscribeExit(login);
    const cancel = (): void => void login.cancel();
    signal.addEventListener(Resources.abortEvent, cancel, { once: true });
    try {
      const starting = client.request(Resources.loginStartMethod, { [Resources.typeField]: Resources.chatGptLoginType }, this.timings.requestTimeout).then(t => {
        const response = JsonReader.fromValue(t, Resources.resultPath);
        login.begin(response.readNonBlankString(Resources.loginIdField));
        return response;
      });
      void starting.catch(() => undefined);
      try {
        const response = await Promise.race([starting, login.wait().then(() => starting)]);
        const page = response.readNonBlankString(Resources.authUrlField);
        if (!CodexAdapter.isSignInPage(page))
          throw new SignInException(Resources.codexSignInPageRefused);
        if (!signal.aborted)
          listener.openLink(page);
        await login.wait();
      }
      catch (error) {
        await login.cancel();
        throw error;
      }
    }
    finally {
      signal.removeEventListener(Resources.abortEvent, cancel);
      exits[Symbol.dispose]();
      notifications[Symbol.dispose]();
    }
  }

  public askIsolated(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult | null> {
    return this.runTurn(request, listener, signal);
  }

  public async runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult> {
    const command = CodexCommand.of(request);
    const refused = Object.isNull(command) ? CommandRefusal.of(this.descriptor.displayName, request, t => Resources.codexCommandNames.includes(t)
      || t.startsWith(Resources.codexPromptCommandPrefix) ? Resources.codexListedCommandsAbility : null) : null;
    if (!Object.isNull(refused))
      return CodexAdapter.noteOnlyAsync(listener, refused, request.resumeNativeSessionId);
    if (!Object.isNull(command) && !command.isReview)
      return this.runThreadCommand(request, command, listener);
    if (!Object.isNull(request.tools) && Object.isNull(request.tools.endpoint))
      return CodexAdapter.fail(Resources.formatToolsNotServed(this.descriptor.displayName), null);
    let client: AppServerClient;
    try {
      const check = this.checkCurrent(request.provider);
      if (!Object.isNull(check) && !await CodexAdapter.waitUnlessAborted(check, signal))
        return new TurnResult(TurnOutcome.Interrupted, null, new ObservedSettings(Resources.codexKindId, null, null, null), null);
      client = await this.connect(request.provider);
    }
    catch (error) {
      return CodexAdapter.fail(FailureDescriber.describe(error), null);
    }

    const lease = this.lease(client);
    try {
      return await this.runTurnOnClient(client, request, listener, signal);
    }
    finally {
      lease[Symbol.dispose]();
    }
  }

  private async runThreadCommand(request: TurnRequest, command: CodexCommand, listener: ITurnListener): Promise<TurnResult> {
    const threadId = request.resumeNativeSessionId;
    if (Object.isNull(threadId))
      return CodexAdapter.noteOnlyAsync(listener, Resources.formatCodexCommandNeedsSession(command.shown), null);
    if (command.name === Resources.codexRenameCommand && command.argument.length === 0)
      return CodexAdapter.noteOnlyAsync(listener, Resources.codexRenameNeedsName, threadId);
    let nativeSessionId: string;
    try {
      nativeSessionId = await this.useClient(request.provider, async client => {
        if (command.name === Resources.codexArchiveCommand)
          await this.closeSessions([threadId]);
        const release = await this.lockThread(threadId, true);
        try {
          return await this.runOnThread(client, request, command, threadId);
        }
        finally {
          release();
        }
      });
    }
    catch (error) {
      return CodexAdapter.fail(FailureDescriber.describe(error), null);
    }
    const note = command.name === Resources.codexForkCommand ? Resources.codexForked
      : command.name === Resources.codexRenameCommand ? Resources.formatCodexRenamed(command.argument) : Resources.codexArchived;
    return CodexAdapter.noteOnlyAsync(listener, note, nativeSessionId);
  }

  private async runOnThread(client: AppServerClient, request: TurnRequest, command: CodexCommand, threadId: string): Promise<string> {
    switch (command.name) {
      case Resources.codexForkCommand: {
        const servers = await this.readServersToTurnOff(client, request.provider, request.workingDirectory);
        const params = { ...CodexAdapter.createThreadParams(request.workingDirectory, request.requested, servers), [Resources.threadIdField]: threadId };
        return (await this.openExisting(client, Resources.threadForkMethod, params, threadId)).threadId;
      }
      case Resources.codexRenameCommand:
        await this.renameThread(client, threadId, command.argument);
        return threadId;
      default:
        await client.request(Resources.threadArchiveMethod, { [Resources.threadIdField]: threadId }, this.timings.requestTimeout);
        return threadId;
    }
  }

  private async renameThread(client: AppServerClient, threadId: string, name: string): Promise<void> {
    const params = { [Resources.threadIdField]: threadId, [Resources.nameField]: name };
    try {
      await client.request(Resources.threadNameSetMethod, params, this.timings.requestTimeout);
    }
    catch (error) {
      if (!FailureDescriber.describe(error).includes(Resources.threadNotFoundMarker))
        throw error;
      try {
        await client.request(Resources.threadUnarchiveMethod, { [Resources.threadIdField]: threadId }, this.timings.requestTimeout);
      }
      catch {
        throw error;
      }
      await client.request(Resources.threadNameSetMethod, params, this.timings.requestTimeout);
    }
  }

  private static async noteOnlyAsync(listener: ITurnListener, note: string, nativeSessionId: string | null): Promise<TurnResult> {
    await listener.onDetailAsync(new TurnDetail(DetailKind.Note, note, null, null));
    return new TurnResult(TurnOutcome.Completed, nativeSessionId, new ObservedSettings(Resources.codexKindId, null, null, null), null);
  }

  private async runTurnOnClient(client: AppServerClient, request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult> {
    const wanted = request.requested;
    let model: ProviderModel | undefined;
    let isListed = false;
    try {
      const models = await this.readModels(client);
      const defaults = await this.readModelDefaults(client, request.workingDirectory);
      model = (defaults?.applyTo(models) ?? models).find(t => t.matches(wanted.model));
      isListed = models.some(t => t.id === model?.id);
    }
    catch (error) {
      if (!Object.isNull(wanted.effort) || !Object.isNull(wanted.speed))
        return CodexAdapter.fail(FailureDescriber.describe(error), null);
    }
    if (!Object.isNull(wanted.effort) && isListed && !Object.isNullOrUndefined(model?.effortLevels) && !model.effortLevels.includes(wanted.effort)
      && wanted.effort !== model.configuredEffort)
      return CodexAdapter.fail(Resources.formatUnknownEffort(wanted.effort, model.displayName), null);
    const listed = model?.speeds.some(t => t.id === wanted.speed) === true;
    const requested = new RequestedSettings(wanted.kind, wanted.model, wanted.effort, listed ? wanted.speed : CodexAdapter.keepsThread(request) ? null : model?.defaultSpeed ?? null, wanted.mode,
      wanted.planFirst, wanted.contextWindow);

    const tools = await ServedToolNames.listAsync(request.tools, signal);
    let servers: readonly string[] | null;
    try {
      servers = request.isolated ? await this.readMcpServers(client, request.workingDirectory)
        : await this.readServersToTurnOff(client, request.provider, request.workingDirectory);
    }
    catch (error) {
      return CodexAdapter.fail(FailureDescriber.describe(error), client.version);
    }
    const params = CodexAdapter.threadKeyOf(request, requested, servers);
    await this.reloadIfChanged(request.resumeNativeSessionId, tools, params);
    const release = await this.lockThread(request.resumeNativeSessionId, true);
    const statuses = new CodexSharedServerStatuses(request.provider?.id ?? this.descriptor.id, request.provider?.label ?? this.descriptor.displayName,
      request.sharedServers.map(t => t.name), listener);
    const subscription = client.subscribe(statuses, listener);
    try {
      return await this.runLockedTurn(client, request, requested, listener, signal, statuses, tools, servers, params);
    }
    finally {
      subscription[Symbol.dispose]();
      release();
    }
  }

  private async runLockedTurn(client: AppServerClient, request: TurnRequest, requested: RequestedSettings,
    listener: ITurnListener, signal: AbortSignal, statuses: CodexSharedServerStatuses, tools: readonly string[] | null, servers: readonly string[] | null,
    params: string): Promise<TurnResult> {
    const endpoint = request.tools?.endpoint ?? null;
    const resumed = this.holdHeld(client, request.resumeNativeSessionId);
    const kept = resumed?.token ?? null;
    const grant: { connection: { url: string; token: string } | null; revoke: () => void } = { connection: null, revoke: () => undefined };
    const issue = (target: McpEndpoint): void => {
      const token = target.issueKept();
      grant.connection = { url: target.url, token };
      grant.revoke = () => target.revoke(token);
    };
    if (!Object.isNull(endpoint)) {
      if (Object.isNull(kept))
        issue(endpoint);
      else
        grant.connection = { url: endpoint.url, token: kept };
    }
    let started: ThreadStartResult | null;
    try {
      started = await this.openThread(client, request, requested, servers, listener, grant.connection, () => {
        if (!Object.isNull(endpoint) && !Object.isNull(kept))
          issue(endpoint);
        return grant.connection;
      });
    }
    catch (error) {
      grant.revoke();
      await this.unholdResumed(client, request.resumeNativeSessionId, resumed);
      return CodexAdapter.fail(FailureDescriber.describe(error), client.version);
    }

    if (Object.isNull(started)) {
      grant.revoke();
      await this.unholdResumed(client, request.resumeNativeSessionId, resumed);
      await listener.onDetailAsync(new TurnDetail(DetailKind.Note, CoreResources.nothingToCompact, null, null));
      return new TurnResult(TurnOutcome.Completed, null, new ObservedSettings(this.descriptor.id, null, null, client.version), null);
    }
    if (started.threadId === request.resumeNativeSessionId && !Object.isNull(kept) && !Object.isNull(endpoint) && !endpoint.adopt(kept)) {
      await listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.codexToolsAwaitTasks, null, null));
      this.log?.write(Resources.formatCodexHeldTokenRefused(started.threadId));
    }

    const servedTier = Object.isNull(requested.speed) || Object.isUndefined(started.serviceTier) ? null : started.serviceTier ?? Resources.codexStandardTier;
    const served = Object.isNull(servedTier) || requested.speed === servedTier ? null : Resources.codexTierNotServedReason;
    const observed = new ObservedSettings(this.descriptor.id, started.model, started.reasoningEffort, client.version, false, servedTier, served);
    await listener.onStartedAsync(new TurnStart(started.threadId, started.threadId === request.resumeNativeSessionId,
      Object.isNull(request.instructions) ? null : RoleApplication.Instructions));
    await listener.onObservedAsync(observed);
    await client.runInOrderAsync(() => statuses.followAsync(started.threadId));

    const turn = new CodexTurn(started.threadId, listener, observed, this.itemReader, new DeltaStream(listener, this.timings.streamInterval));
    const resumes = started.threadId === request.resumeNativeSessionId;
    const sender = resumes ? resumed?.sender ?? null : null;
    if (!Object.isNull(sender) && !request.adoptSender(sender))
      await client.runInOrderAsync(() => this.refuseSenderAsync(listener, turn.threadId));
    if (!resumes)
      await this.unholdResumed(client, request.resumeNativeSessionId, resumed);
    const before = this.totals.get(turn.threadId) ?? (resumes ? null : TokenTotals.zero);
    const input = request.compacts ? null : CodexAdapter.inputOf(resumes ? request.prompt : request.freshPrompt ?? request.prompt, request.attachments);
    const review = CodexCommand.of(request)?.reviewTarget ?? null;
    const held = resumes ? resumed : null;
    const changes = Object.isNull(held) || Object.isNull(input) || !Object.isNull(review) ? null : await this.changesFor(client, held, requested, request.workingDirectory);
    return this.runTurnOnThread(client, turn, listener, input, before, signal, grant.revoke, grant.connection?.token ?? null,
      SenderEnvironment.read(request.environment), tools, held, this.collaborationOf(requested, started),
      !resumes && Object.isNull(requested.contextWindow) && !Object.isNull(started.model) ? CodexAdapter.windowKey(request.provider, started.model) : null,
      CodexAdapter.modeOf(requested), requested.model, requested.effort, request.workingDirectory, params, changes, review);
  }

  private async changesFor(client: AppServerClient, held: ICodexHold, requested: RequestedSettings, workingDirectory: string): Promise<JsonObject | null> {
    const model = requested.model;
    const effort = requested.effort;
    if (!(Object.isNull(model) && !Object.isNull(held.model) || Object.isNull(effort) && !Object.isNull(held.effort)))
      return CodexAdapter.changesOf(held, model, effort, workingDirectory);
    const [models] = await this.readCatalog(client, workingDirectory);
    const resolved = model ?? models.find(t => t.isDefault)?.id;
    const chosen = models.find(t => t.id === resolved);
    return CodexAdapter.changesOf(held, resolved, effort ?? chosen?.configuredEffort ?? chosen?.defaultEffort, workingDirectory);
  }

  public listOwnMcpServers(provider: Provider | null): Promise<readonly OwnMcpServer[]> {
    return this.useClient(provider, async client => {
      const servers = JsonReader.fromValue(await this.readMcpServerEntries(client, provider?.profileDir ?? homedir()));
      return Object.keys(servers.toJson()).filter(t => t !== ProtocolResources.mcpServerName).map(t => {
        const server = servers.readObject(t);
        return new OwnMcpServer(t, server.hasField(Resources.enabledSetting) && !server.readBoolean(Resources.enabledSetting) ? OwnMcpServerState.Disabled
          : OwnMcpServerState.Enabled);
      });
    });
  }

  public async readCompaction(provider: Provider | null, nativeSessionId: string): Promise<string | null> {
    return await CodexCompactionReader.read(this.homeOf(provider), nativeSessionId);
  }

  public async carrySession(from: Provider | null, to: Provider, nativeSessionId: string): Promise<SessionCarry> {
    if (this.silencesOf(nativeSessionId).length > 0)
      return SessionCarry.Held;
    for (const [idle, kept] of [...this.kept].filter(([, t]) => t.threadId === nativeSessionId)) {
      kept.held.reload = true;
      this.endKept(idle);
    }
    await Promise.all([...this.releases].filter(t => t.threadId === nativeSessionId).map(t => t.done.promise));
    try {
      const home = this.homeOf(from);
      const file = await CodexSessionFile.find(home, nativeSessionId);
      return !Object.isNull(file) && await SessionFileCarry.copy(home, to.profileDir, file) ? SessionCarry.Carried : SessionCarry.Unread;
    }
    catch (error) {
      this.log?.write(Resources.formatSessionNotCarried(Resources.codexDisplayName, nativeSessionId, FailureDescriber.describe(error)));
      return SessionCarry.Unread;
    }
  }

  private homeOf(provider: Provider | null): string {
    return provider?.profileDir ?? UsualFolder.of(this.baseEnvironment, Resources.codexHomeVariable, Resources.codexHomeFolderName);
  }

  public async readPlanUsage(provider: Provider | null): Promise<PlanReading | null> {
    try {
      const windows = await this.useClient(provider, async client => {
        const answer = await client.request(Resources.rateLimitsReadMethod, null, this.timings.requestTimeout);
        return this.rateLimitsOf(client).merge(JsonReader.fromValue(answer, Resources.resultPath).toJson()[Resources.rateLimitsField]);
      });
      return Object.isNull(windows) ? null : new PlanReading(windows);
    }
    catch {
      return null;
    }
  }

  public sharedServerUnavailable(server: SharedMcpServerDefinition): SharedMcpRefusal | null {
    const withheld = server.referencedVariables.find(t => CodexEnvironment.withholds(t));
    return CodexAdapter.launch.refusalOf(server, this.descriptor.displayName)
      ?? (Object.isUndefined(withheld) ? null : new SharedMcpRefusal(Resources.formatSharedMcpVariableWithheld(this.descriptor.displayName, withheld),
        Resources.formatSharedMcpVariableWithheldShort(withheld)));
  }

  public savedSecretsUnavailable(): SharedMcpRefusal | null {
    return new SharedMcpRefusal(Resources.formatSavedSecretsFromEnvironmentOnly(this.descriptor.displayName), Resources.savedSecretsFromEnvironmentOnlyShort);
  }

  public formatQuestionReply(replyTo: string, question: string, answer: string): string {
    const reply = { [Resources.questionItemIdField]: replyTo, [Resources.questionField]: question, [Resources.answerField]: answer };
    return `${Resources.codexQuestionReplyOpen}${JSON.stringify(reply)}${Resources.codexQuestionReplyClose}`;
  }

  public async forkSession(request: ForkRequest): Promise<ForkedSession> {
    return this.useClient(request.provider, async client => {
      const servers = await this.readServersToTurnOff(client, request.provider, request.workingDirectory);
      const params = {
        ...CodexAdapter.createThreadParams(request.workingDirectory, request.requested, servers),
        [Resources.threadIdField]: request.nativeSessionId,
        [Resources.lastTurnIdField]: request.lastTurnId
      };
      const forked = await this.openExisting(client, Resources.threadForkMethod, params, request.nativeSessionId);

      return new ForkedSession(this.descriptor.id, request.provider?.id ?? null, forked.threadId);
    });
  }

  public async shutdown(): Promise<void> {
    this.stopped = true;
    this.stopping.abort();
    this.serverProgram?.stop();
    for (const idle of [...this.idle.values(), ...this.kept.keys()])
      idle.stop();
    this.idle.clear();
    this.kept.clear();
    this.closing.clear();
    const lists = [...this.taskLists];
    const tasks = Promise.all(lists.filter(t => t instanceof CodexTasks).map(t => t.stopAll()));
    await Promise.all([tasks, ...lists.filter(t => t instanceof CodexSubAgents).map(t => t.stopAll(tasks, this.timings.interruptTimeout))]);
    const starting = [...this.clients.values(), ...[...this.retired].map(t => Promise.resolve(t))];
    this.clients.clear();
    this.retired.clear();
    const failures: unknown[] = [];
    const settle = async (stop: Promise<void>): Promise<void> => {
      try {
        await stop;
      }
      catch (error) {
        failures.push(error);
      }
    };
    await Promise.all([...this.starting].map(t => settle(t.stop())));
    for (const promise of starting) {
      let client: AppServerClient;
      try {
        client = await promise;
      }
      catch {
        continue;
      }
      await settle(client.stop());
    }
    await Promise.allSettled(this.reading);
    if (failures.length > 0)
      throw failures[0];
  }

  private async runTurnOnThread(client: AppServerClient, turn: CodexTurn, listener: ITurnListener, input: readonly JsonObject[] | null,
    before: TokenTotals | null, signal: AbortSignal, revoke: () => void, token: string | null, sender: string | null, tools: readonly string[] | null,
    resumed: ICodexHold | null, collaboration: JsonObject | null, ownWindow: string | null, mode: string | null, model: string | null,
    effort: string | null, cwd: string | null, params: string | null, changes: JsonObject | null, review: JsonObject | null): Promise<TurnResult> {
    this.router.register(turn);
    this.silencesOf(turn.threadId).forEach(t => t.stop());
    const usage = new CodexUsage(turn.threadId, listener, before, this.rateLimitsOf(client));
    const usageNotifications = client.subscribe(usage, listener);
    const held = resumed ?? this.hold(client, turn.threadId);
    const policy = Object.isNull(resumed) || Object.isNull(input) || !Object.isNull(review) || resumed.mode === mode ? null : CodexAdapter.policyOf(mode);
    if (Object.isNull(resumed) || !Object.isNull(policy))
      held.mode = mode;
    if (Object.isNull(resumed)) {
      held.model = model;
      held.effort = effort;
      held.cwd = cwd;
      held.params = params;
    }
    else if (!Object.isNull(changes))
      Object.assign(held, changes);
    held.revokes.push(revoke);
    if (Object.isNull(resumed)) {
      held.token = token;
      held.sender = sender;
      held.tools = tools;
    }
    const lease = this.lease(client);
    const tasks = new CodexTasks(client, turn.threadId, listener, this.timings.requestTimeout);
    this.taskLists.add(tasks);
    const taskNotifications = client.subscribe(tasks, listener);
    const taskExits = client.subscribeExit(tasks);
    const subAgents = new CodexSubAgents(client, turn, this.childThreadsOf(turn.threadId), listener, this.itemReader, this.timings.requestTimeout,
      t => this.childEndedAsync(client, turn, listener, held, t), this.platform, this.sweep, this.log);
    this.taskLists.add(subAgents);
    this.router.follow(subAgents);
    const subAgentNotifications = client.subscribe(subAgents, listener);
    const subAgentExits = client.subscribeExit(subAgents);
    const notifications = client.subscribe(turn, listener);
    const exits = client.subscribeExit(CodexAdapter.createExitHandler(turn));
    const grace = new AbortTimer(signal, this.timings.interruptGrace);
    const onAbort = (): void => this.interrupt(client, turn, tasks, subAgents);
    signal.addEventListener(Resources.abortEvent, onAbort, { once: true });
    try {
      if (Object.isNull(input))
        await client.request(Resources.threadCompactStartMethod, { threadId: turn.threadId }, this.timings.requestTimeout);
      else if (!Object.isNull(review)) {
        const response = JsonReader.fromValue(await client.request(Resources.reviewStartMethod, { threadId: turn.threadId, [Resources.reviewTargetField]: review },
          this.timings.requestTimeout), Resources.resultPath);
        turn.begin(response.readObject(Resources.turnField).readNonBlankString(Resources.idField));
        this.countStart(turn.threadId);
      }
      else {
        const params = { threadId: turn.threadId, input: [...input], ...policy ?? {}, ...changes ?? {},
          ...Object.isNull(collaboration) ? {} : { [Resources.codexCollaborationModeField]: collaboration } };
        const response = JsonReader.fromValue(await client.request(Resources.turnStartMethod, params, this.timings.requestTimeout), Resources.resultPath);
        const turnId = response.readObject(Resources.turnField).readNonBlankString(Resources.idField);
        turn.begin(turnId);
        listener.onSteerable?.(t => this.steer(client, turn.threadId, turnId, t));
        this.countStart(turn.threadId);
        if (collaboration?.[Resources.codexModeField] === Resources.codexPlanMode)
          this.planningThreads.add(turn.threadId);
        else if (!Object.isNull(collaboration))
          this.planningThreads.delete(turn.threadId);
      }
      if (signal.aborted)
        this.interrupt(client, turn, tasks, subAgents);
      await Promise.race([turn.waitForCompletion(), grace.wait()]);
      if (grace.elapsed)
        turn.interrupt();
      if (turn.stopsCodex)
        this.interrupt(client, turn, tasks, subAgents);
    }
    catch (error) {
      turn.fail(FailureDescriber.describe(error));
    }
    finally {
      await client.settledAsync();
      listener.onSteerable?.(null);
      signal.removeEventListener(Resources.abortEvent, onAbort);
      grace[Symbol.dispose]();
      exits[Symbol.dispose]();
      notifications[Symbol.dispose]();
      usageNotifications[Symbol.dispose]();
      this.router.unregister(turn);
    }
    if (!signal.aborted)
      for (const decide of this.turnEnds.get(turn) ?? [])
        await decide();
    this.turnEnds.delete(turn);
    this.silencesOf(turn.threadId).forEach(t => t.start());
    const totals = usage.totals;
    if (!Object.isNull(totals))
      this.totals.set(turn.threadId, totals);
    const window = usage.window;
    if (!Object.isNull(ownWindow) && !Object.isNull(window))
      this.reportedWindows.set(ownWindow, window);

    const reload = turn.outcome === TurnOutcome.Failed || grace.elapsed;
    const closed = this.closing.delete(turn.threadId);
    const keeping = reload || closed ? null : this.keepIdle(turn.threadId, held);
    const unholdThenFinish = async (): Promise<void> => {
      await this.unhold(client, turn.threadId, held, reload);
      const finish = (): void => {
        this.taskLists.delete(subAgents);
        lease[Symbol.dispose]();
      };
      void subAgents.whenStopped().then(finish);
    };
    const releaseAfterTasks = async (): Promise<void> => {
      this.taskLists.delete(tasks);
      this.router.unfollow(subAgents);
      taskExits[Symbol.dispose]();
      taskNotifications[Symbol.dispose]();
      subAgentExits[Symbol.dispose]();
      subAgentNotifications[Symbol.dispose]();
      await keeping?.ended;
      if (reload)
        await unholdThenFinish();
      else
        await this.releaseKept(turn.threadId, unholdThenFinish, keeping?.release);
    };
    client.subscribe(tasks);
    client.subscribe(subAgents);
    tasks.finishTurn();
    subAgents.finishTurn();
    const lists = [tasks, subAgents];
    if (lists.every(t => t.isIdle)) {
      const releasing = releaseAfterTasks();
      if (reload)
        await releasing;
    }
    else
      this.holdWhileActive(client, turn.threadId, tasks, subAgents, releaseAfterTasks);
    return turn.toResult(signal.aborted);
  }

  private holdWhileActive(client: AppServerClient, threadId: string, tasks: CodexTasks, subAgents: CodexSubAgents, release: () => Promise<void>): void {
    const silence = new Deadline(this.idleTimer, this.timings.silenceLimit, () => {
      void subAgents.stopAll(tasks.stopAll(), this.timings.interruptTimeout);
    });
    const activity = client.subscribe(new CodexActivity(threadId, t => subAgents.follows(t), silence));
    this.silences.set(silence, threadId);
    silence.start();
    void Promise.all([tasks.whenIdle(), subAgents.whenIdle()]).then(() => {
      silence.stop();
      this.silences.delete(silence);
      activity[Symbol.dispose]();
      return release();
    });
  }

  private keepIdle(threadId: string, held: ICodexHold): { readonly ended: Promise<void>;
    readonly release: { readonly threadId: string; readonly done: PromiseWithResolvers<void> }; } {
    const kept = Promise.withResolvers<void>();
    const idle = new Deadline(this.idleTimer, this.timings.idleLimit, () => this.endKept(idle));
    const release = { threadId, done: Promise.withResolvers<void>() };
    this.releases.add(release);
    this.kept.set(idle, { threadId, held, resolve: () => kept.resolve() });
    idle.start();
    return { ended: kept.promise, release };
  }

  private endKept(idle: Deadline): void {
    idle.stop();
    this.kept.get(idle)?.resolve();
    this.kept.delete(idle);
  }

  public closeSessions(nativeSessionIds: readonly string[]): Promise<void> {
    for (const [idle] of [...this.kept].filter(([, t]) => nativeSessionIds.includes(t.threadId)))
      this.endKept(idle);
    for (const threadId of nativeSessionIds.filter(t => this.router.all().some(s => s.threadId === t && !s.isComplete)))
      this.closing.add(threadId);
    return Promise.resolve();
  }

  private async reloadIfChanged(threadId: string | null, tools: readonly string[] | null, params: string): Promise<void> {
    if (Object.isNull(threadId) || this.silencesOf(threadId).length > 0)
      return;
    const changed = [...this.kept].filter(([, t]) => t.threadId === threadId && (!Object.isNull(tools) && JSON.stringify(t.held.tools) !== JSON.stringify(tools)
      || !Object.isNull(t.held.params) && t.held.params !== params));
    if (changed.length === 0)
      return;
    for (const [idle, kept] of changed) {
      kept.held.reload = true;
      this.endKept(idle);
    }
    await Promise.all([...this.releases].filter(t => t.threadId === threadId).map(t => t.done.promise));
  }

  private async releaseKept(threadId: string, release: () => Promise<void>,
    kept: { readonly threadId: string; readonly done: PromiseWithResolvers<void> } | undefined): Promise<void> {
    const unlock = await this.lockThread(threadId, false);
    try {
      await release();
    }
    finally {
      unlock();
      if (!Object.isUndefined(kept)) {
        this.releases.delete(kept);
        kept.done.resolve();
      }
    }
  }

  private silencesOf(threadId: string): Deadline[] {
    return [...this.silences].filter(([, thread]) => thread === threadId).map(([silence]) => silence);
  }

  private async childEndedAsync(client: AppServerClient, parent: CodexTurn, listener: ITurnListener, held: ICodexHold, wake: TurnWake): Promise<void> {
    const running = this.router.all().find(t => t.threadId === parent.threadId && !t.isComplete);
    if (Object.isNullOrUndefined(running)) {
      await this.wakeAsync(client, parent, listener, held, wake);
      return;
    }
    const followUps = running.followUpItems;
    const ends = this.turnEnds.get(running) ?? [];
    ends.push(async () => {
      if (running.followUpItems === followUps)
        await this.wakeAsync(client, parent, listener, held, wake);
    });
    this.turnEnds.set(running, ends);
  }

  private async wakeAsync(client: AppServerClient, parent: CodexTurn, listener: ITurnListener, held: ICodexHold, wake: TurnWake): Promise<void> {
    const starts = this.turnStarts.get(parent.threadId);
    const target = await listener.onWakeAsync(wake);
    if (Object.isNull(target))
      return;
    held.count += 1;
    const stop = new AbortController();
    let settled = false;
    target.onInterrupt(() => {
      stop.abort();
      if (settled)
        return;
      settled = true;
      void this.endUnrun(client, parent, target, held, TurnOutcome.Interrupted, null);
    });
    await target.onToolsAsync(t => {
      if (!Object.isNull(held.token))
        t.adopt(held.token);
      return Promise.resolve();
    });
    target.onFollowed(() => {
      if (settled)
        return;
      settled = true;
      void this.runWake(client, parent, target, held, starts, stop.signal);
    });
  }

  private async runWake(client: AppServerClient, parent: CodexTurn, target: WakeTurn, held: ICodexHold, starts: number | undefined,
    signal: AbortSignal): Promise<void> {
    const release = await this.lockThread(parent.threadId, false);
    try {
      if (signal.aborted || this.turnStarts.get(parent.threadId) !== starts) {
        await this.endUnrun(client, parent, target, held, signal.aborted ? TurnOutcome.Interrupted : TurnOutcome.Completed,
          signal.aborted ? null : Resources.codexWakeTaken);
        return;
      }
      if (!Object.isNull(held.sender) && !target.adoptSender(held.sender))
        await this.refuseSenderAsync(target, parent.threadId);
      await target.onStartedAsync(new TurnStart(parent.threadId, true, null));
      await target.onObservedAsync(parent.observed);
      const turn = new CodexTurn(parent.threadId, target, parent.observed, this.itemReader, new DeltaStream(target, this.timings.streamInterval));
      target.end(await this.runTurnOnThread(client, turn, target, [CodexAdapter.textInputOf(Resources.codexWakePrompt)],
        this.totals.get(parent.threadId) ?? null, signal, () => undefined, null, null, null, held, null, null, target.planFirst ? Resources.codexPlanMode : target.mode ?? held.mode, held.model, held.effort, held.cwd, held.params, null, null));
    }
    finally {
      release();
    }
  }

  private async lockThread(threadId: string | null, logs: boolean): Promise<() => void> {
    if (Object.isNull(threadId))
      return () => undefined;
    const previous = this.threadLocks.get(threadId);
    const ended = Promise.withResolvers<void>();
    const lock = (previous ?? Promise.resolve()).then(() => ended.promise);
    this.threadLocks.set(threadId, lock);
    if (logs && !Object.isUndefined(previous))
      this.log?.write(Resources.formatCodexTurnAwaitsThread(threadId));
    await previous;
    return () => {
      ended.resolve();
      if (this.threadLocks.get(threadId) === lock)
        this.threadLocks.delete(threadId);
    };
  }

  private countStart(threadId: string): void {
    this.turnStarts.set(threadId, (this.turnStarts.get(threadId) ?? 0) + 1);
  }

  private async endUnrun(client: AppServerClient, parent: CodexTurn, target: WakeTurn, held: ICodexHold, outcome: TurnOutcome,
    note: string | null): Promise<void> {
    await this.unhold(client, parent.threadId, held, false);
    if (!Object.isNull(note)) {
      await target.onStartedAsync(new TurnStart(parent.threadId, true, null));
      await target.onDetailAsync(new TurnDetail(DetailKind.Note, note, null, null));
    }
    target.end(new TurnResult(outcome, parent.threadId, parent.observed, null));
  }

  private async refuseSenderAsync(listener: ITurnListener, threadId: string): Promise<void> {
    await listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.codexSenderRefused, null, null));
    this.log?.write(Resources.formatCodexHeldSenderRefused(threadId));
  }

  private rateLimitsOf(client: AppServerClient): CodexRateLimits {
    const known = this.rateLimits.get(client);
    if (!Object.isUndefined(known))
      return known;
    const limits = new CodexRateLimits();
    this.rateLimits.set(client, limits);
    return limits;
  }

  private holdHeld(client: AppServerClient, threadId: string | null): ICodexHold | null {
    const held = Object.isNull(threadId) ? undefined : this.holds.get(client)?.get(threadId);
    if (Object.isUndefined(held))
      return null;
    held.count += 1;
    return held;
  }

  private async unholdResumed(client: AppServerClient, threadId: string | null,
    resumed: ICodexHold | null): Promise<void> {
    if (!Object.isNull(threadId) && !Object.isNull(resumed))
      await this.unhold(client, threadId, resumed, false);
  }

  private hold(client: AppServerClient, threadId: string): ICodexHold {
    const threads = this.holds.get(client) ?? new Map<string, ICodexHold>();
    const held = threads.get(threadId) ?? { count: 0, reload: false, revokes: [], token: null, sender: null, tools: null, mode: null, model: null, effort: null, cwd: null, params: null };
    held.count += 1;
    threads.set(threadId, held);
    this.holds.set(client, threads);
    return held;
  }

  private async unhold(client: AppServerClient, threadId: string, held: ICodexHold, reload: boolean): Promise<void> {
    held.count -= 1;
    held.reload ||= reload;
    if (held.count > 0)
      return;
    this.holds.get(client)!.delete(threadId);
    this.turnStarts.delete(threadId);
    await this.release(client, threadId, held.reload);
    for (const revoke of held.revokes)
      revoke();
  }

  private async release(client: AppServerClient, threadId: string, reload: boolean): Promise<void> {
    await client.request(Resources.threadUnsubscribeMethod, { threadId }, this.timings.requestTimeout).catch(() => undefined);
    if (reload)
      await client.request(Resources.threadArchiveMethod, { threadId }, this.timings.requestTimeout)
        .then(() => client.request(Resources.threadUnarchiveMethod, { threadId }, this.timings.requestTimeout))
        .catch(() => undefined);
  }

  private async useClient<T>(provider: Provider | null, work: (client: AppServerClient) => Promise<T>): Promise<T> {
    const check = this.checkCurrent(provider);
    if (!Object.isNull(check))
      await check;
    const client = await this.connect(provider);
    return this.useLeased(client, () => work(client));
  }

  private async useLeased<T>(client: AppServerClient, work: () => Promise<T>): Promise<T> {
    const lease = this.lease(client);
    try {
      return await work();
    }
    finally {
      lease[Symbol.dispose]();
    }
  }

  private checkCurrent(provider: Provider | null): Promise<void> | null {
    const key = CodexAdapter.keyOf(provider);
    const existing = this.clients.get(key);
    const command = this.commands.current;
    return Object.isUndefined(existing) || Object.isNull(command) ? null : this.checkExisting(key, existing, provider, command);
  }

  private async checkExisting(key: string, existing: Promise<AppServerClient>, provider: Provider | null, executable: ProcessCommand): Promise<void> {
    const client = await existing;
    if (this.keepingOwnServers.has(existing) !== CodexAdapter.keepsOwnServers(provider) && this.clients.get(key) === existing) {
      this.clients.delete(key);
      this.retire(client);
      return;
    }
    const stamp = this.versionReader.readStamp(executable);
    let check = this.checks.get(client);
    if (Object.isUndefined(check) || check.stamp !== stamp || this.timer.now() >= check.retryAt) {
      const started = { stamp, done: Promise.resolve(), retryAt: Number.POSITIVE_INFINITY };
      started.done = this.checkVersion(key, existing, client, executable.withOrigin(this.originOf(provider)), started);
      const done = started.done;
      this.reading.add(done);
      const forget = (): boolean => this.reading.delete(done);
      void done.then(forget, forget);
      this.checks.set(client, started);
      check = started;
    }
    await check.done;
  }

  private async checkVersion(key: string, existing: Promise<AppServerClient>, client: AppServerClient, command: ProcessCommand, check: { retryAt: number }): Promise<void> {
    const installed = await this.versionReader.read(command, this.baseEnvironment, this.stopping.signal);
    if (Object.isNull(installed))
      check.retryAt = this.timer.now() + this.timings.versionTimeout;
    else if (!Object.isNull(client.version) && installed !== client.version && this.clients.get(key) === existing) {
      this.clients.delete(key);
      this.retire(client);
    }
  }

  private static async waitUnlessAborted(work: Promise<void>, signal: AbortSignal): Promise<boolean> {
    const aborted = Promise.withResolvers<boolean>();
    const abort = (): void => aborted.resolve(false);
    signal.addEventListener(Resources.abortEvent, abort, { once: true });
    try {
      return await Promise.race([work.then(() => true), aborted.promise]);
    }
    finally {
      signal.removeEventListener(Resources.abortEvent, abort);
    }
  }

  private originOf(provider: Provider | null): ProcessOrigin {
    return new ProcessOrigin(this.descriptor.id, provider?.id ?? null);
  }

  private lease(client: AppServerClient): Disposable {
    this.leased.push(client);
    this.idle.get(client)?.stop();
    return {
      [Symbol.dispose]: (): void => {
        this.leased.splice(this.leased.indexOf(client), 1);
        if (this.leased.includes(client))
          return;
        if (this.retired.delete(client)) {
          this.idle.delete(client);
          void client.stop();
        }
        else
          this.idle.get(client)?.start();
      }
    };
  }

  private closeIdle(key: string, starting: Promise<AppServerClient>, client: AppServerClient): void {
    this.idle.delete(client);
    this.forget(key, starting);
    void client.stop();
  }

  private retire(client: AppServerClient): void {
    if (this.leased.includes(client))
      this.retired.add(client);
    else
      void client.stop();
  }

  private connect(provider: Provider | null): Promise<AppServerClient> {
    if (this.stopped)
      return Promise.reject(new ProviderStoppedException(Resources.codexShutDown));
    const key = CodexAdapter.keyOf(provider);
    const keepsOwnServers = CodexAdapter.keepsOwnServers(provider);
    const existing = this.clients.get(key);
    if (!Object.isUndefined(existing))
      return existing;

    const starting = this.startClient(Object.isNull(provider) ? null : provider.profileDir, this.originOf(provider), keepsOwnServers);
    this.clients.set(key, starting);
    if (keepsOwnServers)
      this.keepingOwnServers.add(starting);
    void starting.then(client => {
      client.subscribeExit(this.createForgetHandler(key, starting));
      this.idle.set(client, new Deadline(this.idleTimer, this.timings.idleLimit, () => this.closeIdle(key, starting, client)));
    }, () => this.forget(key, starting));

    return starting;
  }

  private async startClient(profileDir: string | null, origin: ProcessOrigin, keepsOwnServers: boolean): Promise<AppServerClient> {
    const command = this.commands.current;
    if (Object.isNull(command))
      throw new ExecutableNotFoundException(Resources.codexNotFound);
    if (!Object.isNull(profileDir))
      mkdirSync(profileDir, { recursive: true });

    const environment = CodexEnvironment.build(await this.starter.readEnvironmentAsync(this.baseEnvironment), profileDir);
    const shared = new CodexServerChoice(CodexAppServerProgram.sharedOf(command), null);
    const program = this.serverProgram;
    const choice = Object.isNull(program) ? shared : await program.choose(command, environment, this.stopping.signal);
    try {
      return await this.startOn(choice, command, environment, origin, keepsOwnServers);
    }
    catch (error) {
      if (Object.isNull(program) || Object.isNull(choice.download) || this.stopped)
        throw error;
      program.refuse(choice.download, FailureDescriber.describe(error));
      return this.startOn(shared, command, environment, origin, keepsOwnServers);
    }
  }

  private async startOn(choice: CodexServerChoice, command: ProcessCommand, environment: NodeJS.ProcessEnv, origin: ProcessOrigin, keepsOwnServers: boolean): Promise<AppServerClient> {
    const server = choice.command;
    const client = new AppServerClient(
      (keepsOwnServers ? server : server.withArguments(Resources.codexConfigArgument, Resources.codexAppsOffArgument)).withOrigin(origin), environment, this.clientInfo,
      this.starter, this.timings, this.log);
    this.checks.set(client, { stamp: this.versionReader.readStamp(command), done: Promise.resolve(), retryAt: Number.POSITIVE_INFINITY });
    client.setServerRequestHandler(this.router);
    const started = client.start();
    this.starting.add(client);
    try {
      await started;
    }
    catch (error) {
      await this.stopFailedStart(client);
      if (Object.isNull(choice.download) && FailureDescriber.describe(error).includes(Resources.codexPackageMismatch))
        throw new ProviderStoppedException(Resources.codexUpdatedWhileInUse);
      throw error;
    }
    finally {
      this.starting.delete(client);
    }

    return client;
  }

  private async stopFailedStart(client: AppServerClient): Promise<void> {
    try {
      await client.stop();
    }
    catch (error) {
      this.log?.write(Resources.formatCodexFailedStartStopFailed(CoreResources.formatFailureKind(error)));
    }
  }

  private forget(key: string, starting: Promise<AppServerClient>): void {
    if (this.clients.get(key) === starting)
      this.clients.delete(key);
  }

  private createForgetHandler(key: string, starting: Promise<AppServerClient>): IExitHandler {
    return {
      handleExitAsync: (): Promise<void> => {
        this.forget(key, starting);
        return Promise.resolve();
      }
    };
  }

  private async openThread(client: AppServerClient, request: TurnRequest, requested: RequestedSettings, servers: readonly string[] | null, listener: ITurnListener,
    served: { url: string; token: string } | null, reissue: () => { url: string; token: string } | null): Promise<ThreadStartResult | null> {
    const paramsOf = (connection: { url: string; token: string } | null): JsonObject => CodexAdapter.createThreadParams(request.workingDirectory, requested, servers,
      request.instructions, request.environment, CodexAdapter.teamRunServerOf(request.tools ?? null, connection), request.sharedServers, request.isolated);
    const params = paramsOf(served);
    const resumeId = request.resumeNativeSessionId;
    if (Object.isNull(resumeId))
      return request.compacts ? null : this.startThread(client, params);

    try {
      return await this.resumeThread(client, CodexAdapter.keepsThread(request) && Object.isNull(requested.speed) ? CodexAdapter.withoutTier(params) : params, resumeId);
    }
    catch (error) {
      if (request.compacts)
        return null;
      await listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatResumeFailed(FailureDescriber.describe(error)), Resources.resumeNotePayload, null));
      return this.startThread(client, paramsOf(reissue()));
    }
  }

  private static keepsThread(request: TurnRequest): boolean {
    return !Object.isNull(request.resumeNativeSessionId) && Object.isNull(request.requested.model) && Object.isNull(request.requested.effort);
  }

  private static withoutTier(params: JsonObject): JsonObject {
    return Object.fromEntries(Object.entries(params).filter(([t]) => t !== Resources.codexServiceTierField));
  }

  private resumeThread(client: AppServerClient, params: JsonObject, threadId: string): Promise<ThreadStartResult> {
    return this.openExisting(client, Resources.threadResumeMethod, { ...params, [Resources.threadIdField]: threadId }, threadId);
  }

  private async openExisting(client: AppServerClient, method: string, request: JsonObject, threadId: string): Promise<ThreadStartResult> {
    let unarchived = false;
    let tries = 0;
    for (;;) {
      try {
        return ThreadStartResult.fromJson(await client.request(method, request, this.timings.requestTimeout), Resources.resultPath);
      }
      catch (error) {
        const description = FailureDescriber.describe(error);
        if (description.includes(Resources.archivedMarker) && !unarchived) {
          unarchived = true;
          await client.request(Resources.threadUnarchiveMethod, { threadId }, this.timings.requestTimeout);
          continue;
        }
        tries += 1;
        if (!description.includes(Resources.activeWriterMarker) || tries >= Resources.resumeRetryCount)
          throw error;
        await new Promise(resolve => setTimeout(resolve, this.timings.resumeRetryDelay));
      }
    }
  }

  private async startThread(client: AppServerClient, params: JsonObject): Promise<ThreadStartResult> {
    return ThreadStartResult.fromJson(await client.request(Resources.threadStartMethod, params, this.timings.requestTimeout), Resources.resultPath);
  }

  private async readMcpServers(client: AppServerClient, workingDirectory: string): Promise<readonly string[]> {
    return Object.keys(await this.readMcpServerEntries(client, workingDirectory));
  }

  private async readServersToTurnOff(client: AppServerClient, provider: Provider | null, workingDirectory: string): Promise<readonly string[] | null> {
    return CodexAdapter.keepsOwnServers(provider) ? null : this.readMcpServers(client, workingDirectory);
  }

  private async readMcpServerEntries(client: AppServerClient, workingDirectory: string): Promise<JsonObject> {
    const response = await client.request(Resources.configReadMethod, { [Resources.cwdField]: workingDirectory }, this.timings.requestTimeout);
    const config = JsonReader.fromValue(response, Resources.resultPath).readObject(Resources.configField);
    return config.hasField(Resources.mcpServersSetting) ? config.readObject(Resources.mcpServersSetting).toJson() : {};
  }

  private static threadKeyOf(request: TurnRequest, requested: RequestedSettings, servers: readonly string[] | null): string {
    const environment = Object.fromEntries(Object.entries(request.environment).filter(([t]) => t !== ProtocolResources.senderTokenVariable));
    const settings = new RequestedSettings(requested.kind, null, null, null, null, false, requested.contextWindow);
    return JSON.stringify(CodexAdapter.createThreadParams(request.workingDirectory, settings, servers, request.instructions, environment, null, request.sharedServers,
      request.isolated));
  }

  private static createThreadParams(workingDirectory: string, requested: RequestedSettings, servers: readonly string[] | null, instructions: string | null = null,
    environment: Readonly<Record<string, string>> = {}, teamRun: JsonObject | null = null, shared: readonly SharedMcpServerDefinition[] = [], isolated: boolean = false): JsonObject {
    const mcpServers: Record<string, JsonValue> = {
      ...Object.fromEntries((servers ?? []).map(t => [t, { [Resources.enabledSetting]: false }])),
      ...Object.fromEntries(shared.map(t => [t.name, CodexAdapter.sharedServerOf(t)]))
    };
    if (!Object.isNull(teamRun))
      mcpServers[ProtocolResources.mcpServerName] = teamRun;
    const config: { [key: string]: JsonValue } = {
      mcp_servers: mcpServers, features: { ...Object.isNull(servers) ? {} : { plugins: false, apps: false }, ...Resources.codexOwnComputerToolsOff },
      tools: { update_plan: { enabled: true } },
      ...isolated ? Resources.codexNoToolsConfig : {}
    };
    if (!Object.isNull(requested.effort))
      config[Resources.modelReasoningEffortSetting] = requested.effort;
    if (!Object.isNull(requested.contextWindow))
      config[Resources.codexModelContextWindowSetting] = requested.contextWindow;
    for (const [name, value] of Object.entries(environment))
      config[Resources.formatShellEnvironmentSetting(name.toUpperCase() === Resources.pathVariable ? Resources.pathVariable : name)] = value;

    return {
      cwd: workingDirectory,
      model: requested.model,
      sandbox: isolated ? Resources.readOnlySandbox : CodexAdapter.sandboxOf(CodexAdapter.modeOf(requested))[0],
      approvalPolicy: isolated ? Resources.neverApprovalPolicy : CodexAdapter.sandboxOf(CodexAdapter.modeOf(requested))[1],
      ephemeral: isolated,
      developerInstructions: instructions ?? String.empty,
      config,
      [Resources.codexServiceTierField]: requested.speed === Resources.codexStandardTier ? null : requested.speed
    };
  }

  private static withWindows(model: ProviderModel, reported: number | null): ProviderModel {
    return new ProviderModel(model.id, model.displayName, model.description, model.effortLevels, model.isDefault, model.resolvedModel, model.supportsImages,
      model.defaultEffort, model.effortNames, model.speeds, model.defaultSpeed, CodexAdapter.windowsOf(reported));
  }

  private static windowsOf(reported: number | null): ProviderContextWindows | null {
    if (Object.isNull(reported))
      return new ProviderContextWindows([Resources.codexUnreportedContextWindow], Resources.codexContextWindowMinimum, Resources.codexUnreportedContextWindow, false);
    const own = Math.round(reported / Resources.codexUsableWindowShare / Resources.codexWindowRounding) * Resources.codexWindowRounding;
    return own < Resources.codexContextWindowMinimum ? null
      : new ProviderContextWindows([...Resources.codexContextWindowPresets.filter(t => t < own), own], Resources.codexContextWindowMinimum, own, true);
  }

  private static windowKey(provider: Provider | null, model: string): string {
    return JSON.stringify([provider?.id ?? null, model]);
  }

  private static teamRunServerOf(tools: TurnTools | null, served: { url: string; token: string } | null): JsonObject | null {
    if (Object.isNull(tools) || Object.isNull(served))
      return null;
    return {
      url: served.url,
      [Resources.codexHttpHeadersSetting]: { [Resources.authorizationHeader]: Resources.formatBearerValue(served.token) },
      [Resources.codexToolTimeoutSetting]: Resources.codexToolTimeoutSeconds,
      [Resources.codexToolsSetting]: Object.fromEntries(tools.approvedTools.map(t => [t, { [Resources.codexToolApprovalSetting]: Resources.codexToolsApprovalMode }]))
    };
  }

  private static sharedServerOf(server: SharedMcpServerDefinition): JsonObject {
    const command = server.command;
    if (!Object.isNull(command))
      return { command: CodexAdapter.launch.program, args: CodexAdapter.launch.argumentsOf(command, server.arguments, server.variables),
        env: CodexAdapter.launch.environmentOf({}), [Resources.codexEnvironmentVariablesSetting]: [...server.variables] };
    const http: Record<string, JsonValue> = { url: server.url!, [Resources.codexHttpHeaderVariablesSetting]: Object.fromEntries(server.headers.map(t => [t.name, t.variable])) };
    if (!Object.isNull(server.bearerVariable))
      http[Resources.codexBearerVariableSetting] = server.bearerVariable;
    return http;
  }

  private async readModels(client: AppServerClient): Promise<readonly ProviderModel[]> {
    const models: Map<string, ProviderModel> = new Map();
    let cursor: string | null = null;
    for (let page = 0; page < Resources.maximumModelPages; page++) {
      const params: JsonObject = Object.isNull(cursor) ? {} : { [Resources.cursorField]: cursor };
      const response = JsonReader.fromValue(await client.request(Resources.modelListMethod, params, this.timings.requestTimeout), Resources.resultPath);
      for (const row of response.readObjectArray(Resources.dataField).filter(t => !t.readBoolean(Resources.hiddenField))) {
        const model = CodexModelReader.read(row);
        models.set(model.id, model);
      }
      cursor = response.readNullableString(Resources.nextCursorField);
      if (Object.isNull(cursor))
        return [...models.values()];
    }
    throw new ModelListException(Resources.modelCatalogTooLarge);
  }

  private async readModelDefaults(client: AppServerClient, workingDirectory: string | null): Promise<CodexModelDefaults | null> {
    try {
      const params: JsonObject = Object.isNull(workingDirectory) ? {} : { [Resources.cwdField]: workingDirectory };
      const response = await client.request(Resources.configReadMethod, params, this.timings.requestTimeout);
      return CodexModelDefaults.fromConfig(JsonReader.fromValue(response, Resources.resultPath).readObject(Resources.configField));
    }
    catch {
      return null;
    }
  }

  private async readSignedIn(client: AppServerClient): Promise<boolean | null> {
    try {
      const response = await client.request(Resources.accountReadMethod, { refreshToken: false }, this.timings.requestTimeout);
      if (!Object.isNull(CodexAccount.fromJson(response, Resources.resultPath)))
        return true;
      return JsonReader.fromValue(response, Resources.resultPath).toJson()[Resources.requiresOpenaiAuthField] === false ? null : false;
    }
    catch {
      return null;
    }
  }

  private async readAccount(client: AppServerClient): Promise<CodexAccount | null> {
    const response = await client.request(Resources.accountReadMethod, { refreshToken: false }, this.timings.requestTimeout);
    return CodexAccount.fromJson(response, Resources.resultPath);
  }

  private childThreadsOf(threadId: string): Map<string, JsonObject> {
    const known = this.childThreads.get(threadId) ?? new Map<string, JsonObject>();
    this.childThreads.set(threadId, known);
    return known;
  }

  private interrupt(client: AppServerClient, turn: CodexTurn, tasks: CodexTasks, subAgents: CodexSubAgents): void {
    tasks.interrupt();
    const interrupted = turn.requestInterrupt()
      ?.then(turnId => client.request(Resources.turnInterruptMethod, { threadId: turn.threadId, turnId }, this.timings.interruptTimeout))
      .catch(() => undefined);
    void subAgents.stopAll(interrupted ?? Promise.resolve(), this.timings.interruptTimeout);
  }

  private async steer(client: AppServerClient, threadId: string, turnId: string, steer: TurnSteer): Promise<boolean> {
    try {
      await client.request(Resources.turnSteerMethod, { threadId, input: CodexAdapter.inputOf(steer.text, steer.attachments), expectedTurnId: turnId },
        this.timings.requestTimeout);
      return true;
    }
    catch {
      return false;
    }
  }

  private static inputOf(text: string, attachments: readonly MessageAttachment[]): JsonObject[] {
    return [CodexAdapter.textInputOf(text), ...attachments.filter(t => t.isImage).map(t => ({ type: Resources.localImageInputType, path: t.path }))];
  }

  private static textInputOf(text: string): JsonObject {
    return { type: Resources.textInputType, text, text_elements: [] };
  }

  private static modeOf(requested: RequestedSettings): string | null {
    return requested.planFirst ? Resources.codexPlanMode : requested.mode;
  }

  private collaborationOf(requested: RequestedSettings, started: ThreadStartResult): JsonObject | null {
    const plans = CodexAdapter.modeOf(requested) === Resources.codexPlanMode;
    if (!plans && started.collaborationMode !== Resources.codexPlanMode && !this.planningThreads.has(started.threadId))
      return null;
    return {
      [Resources.codexModeField]: plans ? Resources.codexPlanMode : Resources.codexDefaultCollaboration,
      [Resources.codexCollaborationSettingsField]: { [Resources.modelField]: started.model, [Resources.codexReasoningEffortSetting]: started.reasoningEffort,
        [Resources.codexDeveloperInstructionsSetting]: null }
    };
  }

  private static sandboxOf(requested: string | null): readonly [string, string] {
    return CodexAdapter.sandboxes[CodexAdapter.modes.find(t => t.id === requested)?.id ?? Resources.codexDefaultMode]!;
  }

  private static changesOf(held: ICodexHold, model: string | null | undefined, effort: string | null | undefined, cwd: string): JsonObject | null {
    const changes = { ...Object.isNullOrUndefined(model) || held.model === model ? {} : { [Resources.modelField]: model },
      ...Object.isNullOrUndefined(effort) || held.effort === effort ? {} : { [Resources.effortField]: effort },
      ...held.cwd === cwd ? {} : { [Resources.cwdField]: cwd } };
    return Object.keys(changes).length === 0 ? null : changes;
  }

  private static policyOf(mode: string | null): JsonObject {
    const [sandbox, approval] = CodexAdapter.sandboxOf(mode);
    const policy = sandbox === Resources.dangerFullAccessSandbox ? { type: Resources.dangerFullAccessPolicy }
      : sandbox === Resources.readOnlySandbox ? { type: Resources.readOnlyPolicy, networkAccess: false }
        : { type: Resources.workspaceWritePolicy, writableRoots: [], networkAccess: false, excludeTmpdirEnvVar: false, excludeSlashTmp: false };
    return { [Resources.approvalPolicyField]: approval, [Resources.sandboxPolicyField]: policy };
  }

  private static keepsOwnServers(provider: Provider | null): boolean {
    return provider?.ownMcpServers === true;
  }

  private static keyOf(provider: Provider | null): string {
    return Object.isNull(provider) ? Resources.defaultProfileKey : provider.id;
  }

  private static createExitHandler(turn: CodexTurn): IExitHandler {
    return {
      handleExitAsync: (): Promise<void> => {
        turn.fail(Resources.appServerExitedDuringTurn);
        return Promise.resolve();
      }
    };
  }

  private static isSignInPage(url: string): boolean {
    if (!URL.canParse(url))
      return false;
    const page = new URL(url);
    return page.protocol === Resources.httpsProtocol && page.host === Resources.codexSignInHost && page.username.length === 0 && page.password.length === 0;
  }

  private static async untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
    const aborted = Promise.withResolvers<never>();
    const abort = (): void => aborted.reject(new SignInException(Resources.codexSignInCancelled));
    signal.addEventListener(Resources.abortEvent, abort, { once: true });
    try {
      return await Promise.race([work, aborted.promise]);
    }
    finally {
      signal.removeEventListener(Resources.abortEvent, abort);
    }
  }

  private static throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted)
      throw new SignInException(Resources.codexSignInCancelled);
  }

  private static fail(error: string, harnessVersion: string | null): TurnResult {
    return new TurnResult(TurnOutcome.Failed, null, new ObservedSettings(Resources.codexKindId, null, null, harnessVersion), error);
  }
}
