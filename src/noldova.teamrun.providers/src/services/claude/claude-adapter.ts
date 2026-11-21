/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { EffortLevel, McpServerConfig, McpServerStatus, ModelInfo, Options, PermissionMode, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

import "@noldova/context.core";
import { Resources as CoreResources, type ForkRequest, type ILog, type IProviderAdapter, type IProviderKindInstallation, type ITimer, type ITurnListener, NodeTimer, PlanReading,
  ProfileSearch, SessionCarry, SharedMcpFailure, SharedMcpFailureKind, SharedMcpRefusal, SignInCheck, TimeoutException, TurnDetail, type TurnRequest, TurnOutcome, TurnResult, type TurnTools } from "@noldova/teamrun.core";
import { RoleApplication, AuthStatus, DetailKind, ForkedSession, ObservedSettings, type OwnMcpServer, type Provider, ProviderKind,
  ProfileFolderPath, ProviderContextWindows, ProviderModel, ProviderProfile, type ProviderMode, ProviderModelList, type ProviderSignInCommand, ProviderSpeed, RequestedSettings, Resources as ProtocolResources, type SharedMcpServerDefinition }
  from "@noldova/teamrun.protocol";

import { ExecutableNotFoundException } from "../../exceptions/executable-not-found.exception.js";
import { ProviderStoppedException } from "../../exceptions/provider-stopped.exception.js";
import { SignOutException } from "../../exceptions/sign-out.exception.js";
import { ToolsUnavailableException } from "../../exceptions/tools-unavailable.exception.js";
import type { IClaudeQuery } from "../../interfaces/i-claude-query.js";
import type { IClaudeQueryFactory } from "../../interfaces/i-claude-query-factory.js";
import { InvalidOperationException } from "../../exceptions/invalid-operation.exception.js";
import { ClaudeRun } from "../../models/claude-run.js";
import { CommandSource } from "../../models/command-source.js";
import type { ProcessCommand } from "../../models/process-command.js";
import { ProcessOrigin } from "../../models/process-origin.js";
import { ProviderAbilityTable } from "../../models/provider-ability-table.js";
import type { ProviderTimings } from "../../models/provider-timings.js";
import { Resources } from "../../resources.js";
import { AcpCommands } from "../acp/acp-commands.js";
import type { ExecutableVersionReader } from "../executables/executable-version.reader.js";
import { FailureDescriber } from "../failure-describer.js";
import { JsonlTail } from "../jsonl-tail.js";
import { SessionFileCarry } from "../session-file-carry.js";
import { TerminalSignIn } from "../terminal-sign-in.js";
import { UsualFolder } from "../usual-folder.js";
import { SharedMcpLaunch } from "../mcp/shared-mcp-launch.js";
import { ReadOnlyMcpTools } from "../mcp/read-only-mcp-tools.js";
import { ServedToolNames } from "../mcp/served-tool-names.js";
import type { CommandRunner } from "../process/command-runner.js";
import { ClaudeEnvironment } from "./claude-environment.js";
import { ClaudeMcpServers } from "./claude-mcp-servers.js";
import { ClaudeSignInReader } from "./claude-sign-in.reader.js";
import { DeltaStream } from "../delta-stream.js";
import { ClaudeChat } from "./claude-chat.js";
import { ClaudeCompactionReader } from "./claude-compaction.reader.js";
import { ClaudeModes } from "./claude-modes.js";
import { ClaudeSessionFile } from "./claude-session-file.js";
import { ClaudePlan } from "./claude-plan.js";
import { ClaudeTasks } from "./claude-tasks.js";
import { ClaudeTurn } from "./claude-turn.js";
import { ClaudePrompt } from "./claude-prompt.js";
import { ClaudeUsageReader } from "./claude-usage.reader.js";

export class ClaudeAdapter implements IProviderAdapter {
  private static readonly launch: SharedMcpLaunch = new SharedMcpLaunch();
  private static readonly speeds: readonly ProviderSpeed[] = [new ProviderSpeed(Resources.claudeStandardSpeed, Resources.claudeStandardSpeedName),
    new ProviderSpeed(Resources.claudeFastSpeed, Resources.claudeFastSpeedName)];
  public readonly takesTeamRunTools: boolean = true;
  public readonly profileSearch: ProfileSearch;
  public readonly modes: readonly ProviderMode[] = ClaudeModes.all;
  public readonly defaultMode: string = Resources.acceptEditsPermissionMode;
  public readonly explorerMode: string = Resources.planPermissionMode;
  public readonly planMode: string = Resources.planPermissionMode;
  private readonly commands: CommandSource;
  private readonly baseEnvironment: NodeJS.ProcessEnv;
  private kind: ProviderKind;
  private readonly homeDirectory: string;
  private readonly appVersion: string;
  private readonly queryFactory: IClaudeQueryFactory;
  private readonly runner: CommandRunner;
  private readonly versionReader: ExecutableVersionReader;
  private readonly timings: ProviderTimings;
  private readonly timer: ITimer;
  private readonly idleTimer: ITimer;
  private readonly log: ILog | null;
  private readonly signInReader: ClaudeSignInReader = new ClaudeSignInReader();
  private readonly runs: Set<ClaudeRun> = new Set();
  private readonly chats: Set<ClaudeChat> = new Set();
  private readonly servedTools: WeakMap<ClaudeChat, readonly string[] | null> = new WeakMap();
  private readonly chatProviders: WeakMap<ClaudeChat, string | null> = new WeakMap();
  private readonly reportedEfforts: Map<string, string> = new Map();
  private readonly reportedWindows: Map<string, number> = new Map();
  private readonly listed: Map<string | null, readonly ProviderModel[]> = new Map();
  private readonly plans: Map<string, ClaudePlan> = new Map();
  private readonly sessionsWithoutChat: Set<string> = new Set();
  private shutdowns: number = 0;

  public readonly installation?: IProviderKindInstallation;

  public constructor(
    command: ProcessCommand | null,
    baseEnvironment: NodeJS.ProcessEnv,
    appVersion: string,
    queryFactory: IClaudeQueryFactory,
    runner: CommandRunner,
    versionReader: ExecutableVersionReader,
    timings: ProviderTimings,
    timer: ITimer = new NodeTimer(),
    locate: () => ProcessCommand | null = CommandSource.none,
    installation: IProviderKindInstallation | null = null,
    homeDirectory: string = homedir(),
    log: ILog | null = null,
    idleTimer: ITimer = new NodeTimer()) {
    this.log = log;
    this.idleTimer = idleTimer;
    this.kind = ClaudeAdapter.kindOf(UsualFolder.of(baseEnvironment, Resources.claudeConfigDirVariable, Resources.claudeHomeFolderName, homeDirectory));
    this.profileSearch = new ProfileSearch(UsualFolder.places(baseEnvironment, Resources.claudeConfigDirVariable, Resources.claudeHomeFolderName, homeDirectory),
      Resources.claudeProfileEntries);
    this.commands = new CommandSource(command, locate);
    if (!Object.isNull(installation))
      this.installation = installation;
    this.baseEnvironment = baseEnvironment;
    this.homeDirectory = homeDirectory;
    this.appVersion = appVersion;
    this.queryFactory = queryFactory;
    this.runner = runner;
    this.versionReader = versionReader;
    this.timings = timings;
    this.timer = timer;
  }

  public get descriptor(): ProviderKind {
    return this.kind;
  }

  public get activeRunCount(): number {
    return this.runs.size + this.chats.size;
  }

  public async refreshDescriptorAsync(): Promise<void> {
    const passed = await this.runner.readEnvironmentAsync(this.baseEnvironment);
    this.kind = ClaudeAdapter.kindOf(UsualFolder.of(passed, Resources.claudeConfigDirVariable, Resources.claudeHomeFolderName, this.homeDirectory));
  }

  public async readSignInCommand(_provider: Provider): Promise<ProviderSignInCommand | null> {
    return TerminalSignIn.of(this.commands.current, Resources.claudeSignInCommand, await this.runner.readEnvironmentAsync(this.baseEnvironment));
  }

  public checkSignIn(provider: Provider): Promise<SignInCheck> {
    return this.check(provider, {});
  }

  public async checkFoundSignIn(provider: Provider): Promise<SignInCheck> {
    const check = await this.check(provider, { [Resources.claudeNonessentialTrafficVariable]: Resources.enabledValue });
    return new SignInCheck(check.authStatus, null, check.harnessVersion, check.error);
  }

  private async check(provider: Provider, quiet: NodeJS.ProcessEnv): Promise<SignInCheck> {
    const command = this.commands.current;
    if (Object.isNull(command))
      return new SignInCheck(AuthStatus.Error, null, null, Resources.claudeNotFound);

    mkdirSync(provider.profileDir, { recursive: true });
    const passed = await this.runner.readEnvironmentAsync(this.baseEnvironment);
    const environment = { ...ClaudeEnvironment.build(passed, this.ownFolderOf(passed, provider.profileDir), this.appVersion), ...quiet };
    const own = command.withOrigin(this.originOf(provider));
    const version = await this.versionReader.read(own, environment);
    try {
      const status = own.withArguments(Resources.authArgument, Resources.statusArgument, Resources.jsonArgument);
      const result = await this.runner.run(status, environment, this.timings.signInCheckTimeout);
      return this.signInReader.read(result.output, version);
    }
    catch (error) {
      return new SignInCheck(AuthStatus.Error, null, version, FailureDescriber.describe(error));
    }
  }

  public listModels(provider: Provider | null): Promise<ProviderModelList> {
    return this.control(provider, Resources.modelDiscoveryTimedOut, async (query, timeout) => {
      const signedIn = query.accountInfo().then(t => this.signInReader.signedIn(t), () => null);
      const models = await Promise.race([query.supportedModels(), timeout]);
      const list = new ProviderModelList(models.map(t => {
        const levels = t.supportedEffortLevels ?? (t.supportsEffort === false ? [] : null);
        const reported = this.reportedEfforts.get(ClaudeAdapter.effortKey(provider, t.resolvedModel ?? t.value)) ?? null;
        return new ProviderModel(t.value, ClaudeAdapter.nameOf(t, models), t.description, levels, t.value === Resources.claudeDefaultModel, t.resolvedModel ?? null, null,
          !Object.isNull(reported) && (levels ?? []).includes(reported as EffortLevel) ? reported : null, {},
          t.supportsFastMode === true ? ClaudeAdapter.speeds : [], t.supportsFastMode === true ? Resources.claudeStandardSpeed : null,
          ClaudeAdapter.windowsOf(this.reportedWindows.get(ClaudeAdapter.effortKey(provider, t.resolvedModel ?? t.value)) ?? null));
      }),
        await Promise.race([signedIn, timeout]).catch(() => null), false, null, false, ClaudeModes.all, Resources.acceptEditsPermissionMode);
      this.listed.set(provider?.id ?? null, list.models);
      return list;
    });
  }

  public listOwnMcpServers(provider: Provider | null): Promise<readonly OwnMcpServer[]> {
    return ClaudeMcpServers.listInAsync(this.configFileOf(provider));
  }

  public async readPlanUsage(provider: Provider | null): Promise<PlanReading | null> {
    try {
      const windows = await this.control(provider, Resources.planUsageTimedOut, async (query, timeout) => ClaudeUsageReader.readPlan(
        await Promise.race([query.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({ skipBehaviors: true }), timeout])));
      return Object.isNull(windows) ? null : new PlanReading(windows);
    }
    catch {
      return null;
    }
  }

  private async control<T>(provider: Provider | null, timedOut: string, read: (query: IClaudeQuery, timeout: Promise<never>) => Promise<T>): Promise<T> {
    const command = this.commands.current;
    if (Object.isNull(command))
      throw new ExecutableNotFoundException(Resources.claudeNotFound);
    const abort = new AbortController();
    const passed = await this.readBeforeStartAsync();
    const query = this.queryFactory.start(ClaudeAdapter.emptyPrompt(), {
      pathToClaudeCodeExecutable: command.executable,
      env: ClaudeEnvironment.build(passed, this.ownFolderOf(passed, provider?.profileDir ?? null), this.appVersion),
      settingSources: [], strictMcpConfig: true, mcpServers: {}, plugins: [], tools: [], persistSession: false, abortController: abort
    }, this.originOf(provider));
    const run = new ClaudeRun(query, abort);
    this.runs.add(run);
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new TimeoutException(timedOut)), this.timings.requestTimeout);
      });
      return await read(query, timeout);
    }
    finally {
      clearTimeout(timer);
      this.runs.delete(run);
      run.close();
    }
  }

  private static async *emptyPrompt(): AsyncGenerator<SDKUserMessage> {}

  private static async answerNothingToCompactAsync(listener: ITurnListener, observed: ObservedSettings): Promise<TurnResult> {
    await listener.onDetailAsync(new TurnDetail(DetailKind.Note, CoreResources.nothingToCompact, null, null));
    return new TurnResult(TurnOutcome.Completed, null, observed, null);
  }

  public signIn(_provider: Provider, _signal: AbortSignal): Promise<void> {
    return Promise.reject(new InvalidOperationException(Resources.signInNotSupported));
  }

  public async signOut(provider: Provider): Promise<void> {
    const command = this.commands.current;
    if (Object.isNull(command))
      throw new ExecutableNotFoundException(Resources.claudeNotFound);

    const passed = await this.runner.readEnvironmentAsync(this.baseEnvironment);
    const environment = ClaudeEnvironment.build(passed, this.ownFolderOf(passed, provider.profileDir), this.appVersion);
    const logout = command.withOrigin(this.originOf(provider)).withArguments(Resources.authArgument, Resources.logoutArgument);
    const result = await this.runner.run(logout, environment, this.timings.signInCheckTimeout);
    if (result.timedOut)
      throw new TimeoutException(Resources.formatClaudeSignOutTimedOut(this.timings.signInCheckTimeout));
    if (!result.succeeded)
      throw new SignOutException(Resources.formatClaudeSignOutFailed(String.isNullOrWhitespace(result.output) ? null : result.output));
    for (const chat of [...this.chats].filter(t => !t.isBusy && this.chatProviders.get(t) === provider.id)) {
      this.chats.delete(chat);
      void chat.stop();
    }
  }

  public sharedServerUnavailable(server: SharedMcpServerDefinition): SharedMcpRefusal | null {
    const withheld = server.referencedVariables.find(t => ClaudeEnvironment.withholds(t));
    return ClaudeAdapter.launch.refusalOf(server, this.descriptor.displayName)
      ?? (Object.isUndefined(withheld) ? null : new SharedMcpRefusal(Resources.formatSharedMcpVariableWithheld(this.descriptor.displayName, withheld),
        Resources.formatSharedMcpVariableWithheldShort(withheld)));
  }

  public savedSecretsUnavailable(server: SharedMcpServerDefinition): SharedMcpRefusal | null {
    return Object.isNull(server.command)
      ? new SharedMcpRefusal(Resources.formatSavedSecretsStdioOnly(this.descriptor.displayName), Resources.savedSecretsStdioOnlyShort)
      : null;
  }

  public askIsolated(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult | null> {
    return this.runTurn(request, listener, signal);
  }

  public async runTurn(asked: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult> {
    const shutdowns = this.shutdowns;
    const command = this.commands.current;
    if (Object.isNull(command))
      return ClaudeAdapter.fail(Resources.claudeNotFound);

    const request = await this.withListedSpeed(asked, signal);
    if (Object.isNull(request))
      return new TurnResult(TurnOutcome.Interrupted, null, new ObservedSettings(Resources.claudeKindId, null, null, null), null);

    const effort = request.requested.effort as EffortLevel | null;

    const profileDir = Object.isNull(request.provider) ? null : request.provider.profileDir;
    if (!Object.isNull(profileDir))
      mkdirSync(profileDir, { recursive: true });

    const resume = request.resumeNativeSessionId;
    if (request.compacts && Object.isNull(resume))
      return await ClaudeAdapter.answerNothingToCompactAsync(listener, new ObservedSettings(Resources.claudeKindId, null, null, null));
    const prompt = request.compacts ? CoreResources.compactCommand : request.prompt;
    const turn = await this.runQuery(command, request, resume, prompt, effort, profileDir, listener, signal, shutdowns);
    if (Object.isNull(resume) || turn.hasStarted || turn.outcome !== TurnOutcome.Failed || signal.aborted || shutdowns !== this.shutdowns)
      return this.remember(request, turn);

    if (request.compacts)
      return await ClaudeAdapter.answerNothingToCompactAsync(listener, turn.toResult().observed);
    await listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatResumeFailed(turn.error!), Resources.resumeNotePayload, null));
    const fresh = await this.runQuery(command, request, null, request.freshPrompt ?? request.prompt, effort, profileDir, listener, signal, shutdowns);
    return this.remember(request, fresh);
  }

  private async withListedSpeed(request: TurnRequest, signal: AbortSignal): Promise<TurnRequest | null> {
    const requested = request.requested;
    if (Object.isNull(requested.speed))
      return request;
    const models = this.listed.get(request.provider?.id ?? null) ?? await this.listUntilStopped(request.provider, signal);
    if (Object.isNull(models))
      return null;
    return models.find(t => t.matches(requested.model))?.speeds.some(t => t.id === requested.speed) === true ? request
      : request.withRequested(new RequestedSettings(requested.kind, requested.model, requested.effort, null, requested.mode, requested.planFirst,
        requested.contextWindow));
  }

  private async listUntilStopped(provider: Provider | null, signal: AbortSignal): Promise<readonly ProviderModel[] | null> {
    if (signal.aborted)
      return null;
    const stopped = Promise.withResolvers<null>();
    const stop = (): void => stopped.resolve(null);
    signal.addEventListener(Resources.abortEvent, stop, { once: true });
    try {
      return await Promise.race([this.listModels(provider).then(t => t.models, () => []), stopped.promise]);
    }
    finally {
      signal.removeEventListener(Resources.abortEvent, stop);
    }
  }

  private remember(request: TurnRequest, turn: ClaudeTurn): TurnResult {
    const result = turn.toResult();
    const { model, effort } = result.observed;
    if (Object.isNull(request.requested.effort) && !Object.isNull(model) && !Object.isNull(effort))
      this.reportedEfforts.set(ClaudeAdapter.effortKey(request.provider, model), effort);
    const window = turn.modelWindow;
    if (!Object.isNull(model) && !Object.isNull(window))
      this.reportedWindows.set(ClaudeAdapter.effortKey(request.provider, model), window);
    return result;
  }

  private static nameOf(model: ModelInfo, models: readonly ModelInfo[]): string {
    if (model.value !== Resources.claudeDefaultModel)
      return ClaudeAdapter.versionedName(model);
    const same = models.find(t => t !== model && !Object.isUndefined(t.resolvedModel) && t.resolvedModel === model.resolvedModel);
    if (!Object.isUndefined(same))
      return ClaudeAdapter.versionedName(same);
    const parts = ClaudeAdapter.idParts(model.resolvedModel);
    return Object.isNull(parts) ? model.displayName : `${parts.family.charAt(0).toUpperCase()}${parts.family.slice(1)} ${parts.version}`;
  }

  private static versionedName(model: ModelInfo): string {
    if (Resources.claudeModelVersion.test(model.displayName))
      return model.displayName;
    const noteAt = model.displayName.indexOf(Resources.claudeModelNoteStart);
    const family = noteAt < 0 ? model.displayName : model.displayName.slice(0, noteAt);
    const described = model.description.startsWith(`${family} `)
      ? Resources.claudeModelVersionStart.exec(model.description.slice(family.length + 1)) : null;
    const parts = ClaudeAdapter.idParts(model.resolvedModel);
    const version = described?.[1] ?? (parts?.family === family.toLowerCase() ? parts.version : null);
    return Object.isNull(version) ? model.displayName : `${family} ${version}${model.displayName.slice(family.length)}`;
  }

  private static idParts(id: string | undefined): { readonly family: string; readonly version: string } | null {
    const match = Object.isUndefined(id) ? null : Resources.claudeModelId.exec(id);
    const [, family, major, minor] = match ?? [];
    if (Object.isUndefined(family) || Object.isUndefined(major))
      return null;
    return { family, version: Object.isUndefined(minor) ? major : `${major}.${minor}` };
  }

  private static windowsOf(reported: number | null): ProviderContextWindows | null {
    const ceiling = Math.min(reported ?? Resources.claudeAutoCompactWindowMaximum, Resources.claudeAutoCompactWindowMaximum);
    return ceiling < Resources.claudeAutoCompactWindowMinimum ? null
      : new ProviderContextWindows(Resources.claudeContextWindowPresets.filter(t => t <= ceiling), Resources.claudeAutoCompactWindowMinimum, ceiling,
        !Object.isNull(reported));
  }

  private static effortKey(provider: Provider | null, model: string): string {
    return JSON.stringify([provider?.id ?? null, model]);
  }

  private static startModeOf(request: TurnRequest): PermissionMode {
    return request.requested.planFirst ? Resources.planPermissionMode : ClaudeModes.of(request.requested.mode);
  }

  public async plansFirst(nativeSessionIds: readonly string[]): Promise<void> {
    for (const chat of [...this.chats].filter(t => !t.isClosed && !t.isPlanning && nativeSessionIds.some(s => s === t.sessionId))) {
      try {
        await chat.returnToPlan();
      }
      catch (error) {
        this.log?.write(Resources.formatClaudePlanModeNotReturned(chat.sessionId, FailureDescriber.describe(error)));
      }
    }
  }

  public closeSessions(nativeSessionIds: readonly string[]): Promise<void> {
    for (const chat of [...this.chats].filter(t => !t.isClosed && nativeSessionIds.some(s => s === t.sessionId)))
      chat.retire();
    return Promise.resolve();
  }

  public forkSession(request: ForkRequest): Promise<ForkedSession> {
    return Promise.resolve(new ForkedSession(this.descriptor.id, request.provider?.id ?? null, request.nativeSessionId, request.lastTurnId));
  }

  public async shutdown(): Promise<void> {
    this.shutdowns += 1;
    const runs = [...this.runs];
    this.runs.clear();
    for (const run of runs)
      await run.stop();
    const chats = [...this.chats];
    this.chats.clear();
    for (const chat of chats)
      await chat.stop();
  }

  private async readBeforeStartAsync(shutdowns: number = this.shutdowns): Promise<NodeJS.ProcessEnv> {
    const environment = await this.runner.readEnvironmentAsync(this.baseEnvironment);
    if (shutdowns !== this.shutdowns)
      throw new ProviderStoppedException(Resources.formatStoppedForShutdown(this.descriptor.displayName));
    return environment;
  }

  private originOf(provider: Provider | null): ProcessOrigin {
    return new ProcessOrigin(this.descriptor.id, provider?.id ?? null);
  }

  private static kindOf(usual: string): ProviderKind {
    return new ProviderKind(Resources.claudeKindId, Resources.claudeDisplayName, true, false, null,
      new ProviderProfile(Resources.claudeConfigDirVariable, Resources.claudeSignInCommand, usual, null, {}, {}, [usual]),
      true, null, false, null, false, Resources.claudeOwnMcpServersNote, ProviderAbilityTable.claude, false, false, undefined,
      Resources.claudeOwnMcpServersShortNote, false, true);
  }

  private ownFolderOf(passed: NodeJS.ProcessEnv, profileDir: string | null): string | null {
    const usual = UsualFolder.of(passed, Resources.claudeConfigDirVariable, Resources.claudeHomeFolderName, this.homeDirectory);
    return Object.isNull(profileDir) || ProfileFolderPath.isSame(profileDir, usual) ? null : profileDir;
  }

  private async runQuery(command: ProcessCommand, request: TurnRequest, resume: string | null, text: string, effort: EffortLevel | null,
    profileDir: string | null, listener: ITurnListener, signal: AbortSignal, shutdowns: number): Promise<ClaudeTurn> {
    const [chat, settle] = await this.openChat(command, request, resume, effort, profileDir, listener, shutdowns,
      await ServedToolNames.listAsync(request.tools, signal));
    const turn = new ClaudeTurn(listener, resume, new DeltaStream(listener, this.timings.streamInterval),
      Object.isNull(request.instructions) ? null : RoleApplication.Instructions, chat.tasks, this.timings.requestTimeout, chat.plan, chat.subAgents,
      request.requested.planFirst ? () => chat.setPermissionMode(ClaudeModes.of(request.requested.mode)) : null, request.requested.contextWindow);
    const asked = request.compacts ? null : request.command;
    const listed = Object.isNull(asked) ? [] : await chat.listedCommands(signal);
    const alone = !Object.isNull(asked) && listed.includes(AcpCommands.nameOf(asked)) ? asked : null;
    const refusal = this.commandRefusalOf(request, asked, alone, listed);
    if (!Object.isNull(asked) && signal.aborted)
      await turn.endUnsentAsync(null);
    else if (!Object.isNull(refusal))
      await turn.endUnsentAsync(refusal);
    if (!Object.isNull(turn.outcome)) {
      chat.endUnused();
      return turn;
    }
    const sent = alone ?? (!Object.isNull(resume) && this.sessionsWithoutChat.delete(resume) ? request.freshPrompt ?? text : text);
    const message = ClaudePrompt.create(request, sent, randomUUID());
    let graceTimer: NodeJS.Timeout | null = null;
    const onAbort = (): void => chat.interrupt(turn);
    if (signal.aborted)
      onAbort();
    else
      signal.addEventListener(Resources.abortEvent, onAbort, { once: true });

    const settling = new AbortController();
    void settle?.(AbortSignal.any([settling.signal, chat.abort.signal, signal]))
      .catch(error => this.log?.write(Resources.formatClaudeServerSettleFailed(FailureDescriber.describe(error))));

    try {
      chat.allowIdleCompaction(request.compactsWhenIdle);
      await chat.run(turn, message, ClaudeAdapter.senderOf(request), () => {
        graceTimer ??= setTimeout(() => chat.abort.abort(), this.timings.abortGrace);
      });
    }
    finally {
      settling.abort();
      signal.removeEventListener(Resources.abortEvent, onAbort);
      if (!Object.isNull(alone) && Object.isNull(resume) && !Object.isNull(turn.sessionId))
        this.sessionsWithoutChat.add(turn.sessionId);
      if (!Object.isNull(graceTimer))
        clearTimeout(graceTimer);
      if (!Object.isNull(chat.sessionId))
        this.keepPlan(chat.sessionId, chat.plan);
      if (request.isolated) {
        this.chats.delete(chat);
        void chat.stop();
      }
    }

    return turn;
  }

  private commandRefusalOf(request: TurnRequest, asked: string | null, alone: string | null, listed: readonly string[]): string | null {
    if (!Object.isNull(alone))
      return request.attachments.length === 0 ? null : Resources.formatCommandWithFiles(this.descriptor.displayName, AcpCommands.shownOf(alone));
    return Object.isNull(asked) || !Resources.claudeCommandNames.includes(AcpCommands.nameOf(asked)) ? null
      : Resources.formatCommandUnlisted(this.descriptor.displayName, AcpCommands.shownOf(asked), listed);
  }

  private keepPlan(sessionId: string, plan: ClaudePlan): void {
    this.plans.delete(sessionId);
    this.plans.set(sessionId, plan);
    if (this.plans.size > Resources.maximumClaudePlans)
      this.plans.delete(this.plans.keys().next().value!);
  }

  private async openChat(command: ProcessCommand, request: TurnRequest, resume: string | null, effort: EffortLevel | null,
    profileDir: string | null, listener: ITurnListener, shutdowns: number, tools: readonly string[] | null): Promise<readonly [ClaudeChat, ((signal: AbortSignal) => Promise<void>) | null]> {
    const endpoint = request.tools?.endpoint ?? null;
    if (!Object.isNull(request.tools) && Object.isNull(endpoint))
      throw new ToolsUnavailableException(Resources.formatToolsNotServed(this.descriptor.displayName));
    const key = ClaudeAdapter.keyOf(command, request, effort, profileDir, tools);
    const continued = Object.isNull(request.resumeAt) ? resume : null;
    await Promise.all([...this.chats].filter(t => !Object.isNull(resume) && t.sessionId === resume).map(t => t.closing));
    const open = Object.isNull(continued) ? undefined : [...this.chats].find(t => t.sessionId === continued && !t.isClosed && !t.isBusy);
    if (!Object.isUndefined(open) && open.key === key && !(request.requested.planFirst && !open.isPlanning) && await open.prepare(ClaudeAdapter.senderOf(request), listener)
      && !open.isClosed) {
      if (open.adopts(request.tools)) {
        if (!request.requested.planFirst)
          await open.ensureMode(ClaudeModes.of(request.requested.mode), listener);
        return [open, null];
      }
      if (open.isServed && !Object.isNull(endpoint))
        await listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.claudeChatEndedForTools, null, null));
    }
    if (!Object.isUndefined(open)) {
      if (open.isRunningTasks && JSON.stringify(this.servedTools.get(open)) !== JSON.stringify(tools))
        await listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.claudeChatEndedForToolsChange, null, null));
      this.chats.delete(open);
      void open.stop();
    }

    const base = await this.readBeforeStartAsync(shutdowns);
    let served: { url: string; token: string } | null = null;
    let revoke = (): void => undefined;
    if (!Object.isNull(endpoint)) {
      const token = endpoint.issueKept();
      revoke = () => endpoint.revoke(token);
      served = { url: endpoint.url, token };
    }
    let passed: readonly string[] = [];
    const withheld = Object.isNull(served) && ClaudeAdapter.startsOwnServers(request);
    const fromProject = withheld ? await this.projectServerNamesOf(request) : [];
    const chat = new ClaudeChat(key, this.timings.interruptTimeout, this.timings.streamInterval, this.timings.wakeGrace, t => {
      this.chats.delete(t);
      revoke();
    }, new ClaudeTasks(this.timer, this.timings.taskOutputInterval), (Object.isNull(continued) ? undefined : this.plans.get(continued)) ?? new ClaudePlan(),
      undefined, served?.token ?? null, this.log, this.timings.requestTimeout, withheld ? (t, named) => this.ownServersStartedAsync(t, passed, [...fromProject, ...named]) : null,
      this.idleTimer, this.timings.silenceLimit, this.timings.idleLimit);
    const environment: Record<string, string | undefined> = { ...ClaudeEnvironment.build(base, this.ownFolderOf(base, profileDir), this.appVersion, !request.isolated),
      [Resources.claudeSessionStateEventsVariable]: Resources.enabledValue, ...Object.fromEntries(Object.entries(request.environment)
        .filter(([name]) => (Object.isNull(served) && !withheld) || name !== ProtocolResources.senderTokenVariable)) };
    const trusted = !request.isolated && await this.trustsAsync(request);
    const query = this.queryFactory.start(chat.input, this.createOptions(command, request, resume, effort, chat, environment, trusted),
      this.originOf(request.provider));
    chat.attach(query, ClaudeAdapter.startModeOf(request));
    this.chats.add(chat);
    this.chatProviders.set(chat, request.provider?.id ?? null);
    this.servedTools.set(chat, tools);
    const own = await this.ownServersOf(request, environment);
    const others = ClaudeAdapter.serversOf(request, served, environment);
    const servers = { ...own, ...others };
    passed = Object.keys(servers);
    const settle = Object.keys(servers).length > 0 ? await this.serve(chat, query, servers, Object.keys(own).filter(t => !Object.hasOwn(others, t)), request, listener) : null;
    const sender = ClaudeAdapter.senderOf(request);
    if (withheld && Object.keys(sender).length > 0)
      await chat.setSender(query, sender, listener);
    return [chat, settle];
  }

  public async readCompaction(provider: Provider | null, nativeSessionId: string): Promise<string | null> {
    return await ClaudeCompactionReader.read(this.folderOf(provider), nativeSessionId);
  }

  public async carrySession(from: Provider | null, to: Provider, nativeSessionId: string): Promise<SessionCarry> {
    const open = [...this.chats].filter(t => !t.isClosed && t.sessionId === nativeSessionId);
    for (const chat of open.filter(t => !t.isRunningTasks))
      chat.retire();
    if (open.some(t => !t.isClosed))
      return SessionCarry.Held;
    await Promise.all(open.map(t => t.closing));
    try {
      const folder = this.folderOf(from);
      const file = await ClaudeSessionFile.find(folder, nativeSessionId);
      if (!Object.isNull(file) && !Object.isNull(await JsonlTail.lastLineWith(file, Resources.claudeCompactSummaryMarker)))
        return SessionCarry.Refused;
      return !Object.isNull(file) && await SessionFileCarry.copy(folder, to.profileDir, file) ? SessionCarry.Carried : SessionCarry.Unread;
    }
    catch (error) {
      this.log?.write(Resources.formatSessionNotCarried(Resources.claudeDisplayName, nativeSessionId, FailureDescriber.describe(error)));
      return SessionCarry.Unread;
    }
  }

  private folderOf(provider: Provider | null): string {
    return provider?.profileDir ?? UsualFolder.of(this.baseEnvironment, Resources.claudeConfigDirVariable, String.empty, this.homeDirectory);
  }

  private configFileOf(provider: Provider | null): string {
    return join(this.folderOf(provider), Resources.claudeConfigFile);
  }

  private static startsOwnServers(request: TurnRequest): boolean {
    return request.provider?.ownMcpServers === true && !request.isolated;
  }

  private async ownServersOf(request: TurnRequest, environment: Readonly<Record<string, string | undefined>>): Promise<Record<string, McpServerConfig>> {
    if (!ClaudeAdapter.startsOwnServers(request))
      return {};
    try {
      return await ClaudeMcpServers.readInAsync(this.configFileOf(request.provider), request.workingDirectory, environment);
    }
    catch (error) {
      this.log?.write(Resources.formatClaudeOwnServersUnread(FailureDescriber.describe(error)));
      return {};
    }
  }

  private async projectServerNamesOf(request: TurnRequest): Promise<readonly string[]> {
    try {
      return await ClaudeMcpServers.projectServerNamesAsync(this.configFileOf(request.provider), request.workingDirectory);
    }
    catch (error) {
      this.log?.write(Resources.formatClaudeProjectServersUnread(FailureDescriber.describe(error)));
      return [];
    }
  }

  private async trustsAsync(request: TurnRequest): Promise<boolean> {
    try {
      return await ClaudeMcpServers.trustsAsync(this.configFileOf(request.provider), request.workingDirectory);
    }
    catch (error) {
      this.log?.write(Resources.formatClaudeTrustUnread(FailureDescriber.describe(error)));
      return false;
    }
  }

  private async serve(chat: ClaudeChat, query: IClaudeQuery, servers: Record<string, McpServerConfig>, own: readonly string[], request: TurnRequest,
    listener: ITurnListener): Promise<((signal: AbortSignal) => Promise<void>) | null> {
    let errors: Record<string, string>;
    try {
      errors = (await query.setMcpServers(servers)).errors;
    }
    catch (error) {
      chat.close();
      throw own.length > 0 ? new ToolsUnavailableException(Resources.claudeOwnServersNotSet) : error;
    }
    for (const [name, error] of Object.entries(errors))
      this.log?.write(own.includes(name) ? Resources.formatClaudeOwnServerNotSet(name) : Resources.formatClaudeServerNotSet(name, error));
    const shared = request.sharedServers.map(t => t.name);
    return shared.length === 0 ? null : signal => this.settleServers(query, request, shared, errors, listener, signal);
  }

  private async settleServers(query: IClaudeQuery, request: TurnRequest, shared: readonly string[], errors: Readonly<Record<string, string>>,
    listener: ITurnListener, signal: AbortSignal): Promise<void> {
    const report = (name: string, kind: SharedMcpFailureKind): Promise<void> => listener.onSharedServerFailedAsync(new SharedMcpFailure(
      request.provider?.id ?? this.descriptor.id, request.provider?.label ?? this.descriptor.displayName, name, kind));
    for (const name of shared.filter(t => Object.hasOwn(errors, t)))
      await report(name, SharedMcpFailureKind.Connection);
    let waiting = shared.filter(t => !Object.hasOwn(errors, t));
    let stopped = false;
    const stop = (): void => {
      if (!stopped)
        for (const name of waiting)
          this.log?.write(Resources.formatClaudeServerPendingAtTurnEnd(name));
      stopped = true;
    };
    signal.addEventListener(Resources.abortEvent, stop, { once: true });
    try {
      const deadline = this.timer.now() + Resources.claudeServerSettleTimeout;
      while (waiting.length > 0) {
        const statuses = await this.readServerStatuses(query, signal);
        if (signal.aborted)
          return;
        const pending: string[] = [];
        for (const name of waiting) {
          const status = statuses.find(t => t.name === name)?.status;
          if (status === Resources.claudeNeedsAuthStatus)
            await report(name, SharedMcpFailureKind.SignIn);
          else if (status === Resources.claudeFailedStatus)
            await report(name, SharedMcpFailureKind.Connection);
          else if (status === Resources.claudePendingStatus)
            pending.push(name);
        }
        waiting = pending;
        if (waiting.length > 0 && this.timer.now() >= deadline) {
          for (const name of waiting)
            this.log?.write(Resources.formatClaudeServerStillPending(name, Resources.claudeServerSettleTimeout));
          return;
        }
        if (waiting.length > 0 && !await this.timer.delayAsync(Resources.claudeServerSettleInterval, signal).then(() => true, () => false))
          return;
      }
    }
    finally {
      signal.removeEventListener(Resources.abortEvent, stop);
      if (signal.aborted)
        stop();
      stopped = true;
    }
  }

  private async ownServersStartedAsync(query: IClaudeQuery, passed: readonly string[], named: readonly string[]): Promise<boolean> {
    const deadline = this.timer.now() + Resources.claudeServerSettleTimeout;
    const signal = new AbortController().signal;
    for (;;) {
      let statuses: readonly McpServerStatus[];
      try {
        statuses = await query.mcpServerStatus();
      }
      catch (error) {
        this.log?.write(Resources.formatClaudeServerStatusUnread(FailureDescriber.describe(error)));
        return false;
      }
      if (!statuses.some(t => t.status === Resources.claudePendingStatus && !passed.includes(t.name))
        && named.every(name => passed.includes(name) || statuses.some(t => t.name === name)))
        return true;
      if (this.timer.now() >= deadline)
        return false;
      await this.timer.delayAsync(Resources.claudeServerSettleInterval, signal);
    }
  }

  private async readServerStatuses(query: IClaudeQuery, signal: AbortSignal): Promise<readonly McpServerStatus[]> {
    try {
      return await query.mcpServerStatus();
    }
    catch (error) {
      if (!signal.aborted)
        this.log?.write(Resources.formatClaudeServerStatusUnread(FailureDescriber.describe(error)));
      return [];
    }
  }

  private static senderOf(request: TurnRequest): Record<string, string> {
    return Object.fromEntries(Object.entries(request.environment).filter(([name]) => name === ProtocolResources.senderTokenVariable));
  }

  private static keyOf(command: ProcessCommand, request: TurnRequest, effort: EffortLevel | null, profileDir: string | null, tools: readonly string[] | null): string {
    const environment = Object.entries(request.environment).filter(([name]) => name !== ProtocolResources.senderTokenVariable);
    return JSON.stringify([command.executable, request.provider?.id ?? null, profileDir, request.workingDirectory, request.instructions, request.requested.model,
      effort, request.requested.speed, request.requested.mode, request.requested.planFirst, request.requested.contextWindow, environment,
      request.sharedServers.map(t => t.toJson()), request.provider?.ownMcpServers === true, tools]);
  }

  private createOptions(
    command: ProcessCommand,
    request: TurnRequest,
    resume: string | null,
    effort: EffortLevel | null,
    chat: ClaudeChat,
    environment: Record<string, string | undefined>,
    trusted: boolean): Options {
    const mode = ClaudeModes.of(request.requested.mode);
    const ownServers = ClaudeAdapter.startsOwnServers(request);
    const options: Options = {
      cwd: request.workingDirectory,
      env: environment,
      pathToClaudeCodeExecutable: command.executable,
      settingSources: request.isolated ? [] : [...trusted ? Resources.claudeChatSettingSources : Resources.claudeUntrustedSettingSources],
      strictMcpConfig: !ownServers,
      mcpServers: {},
      systemPrompt: ClaudeAdapter.createSystemPrompt(request.instructions),
      abortController: chat.abort,
      includePartialMessages: true,
      extraArgs: { [Resources.claudeThinkingDisplayArgument]: Resources.claudeSummarizedThinkingDisplay },
      maxTurns: Resources.claudeMaximumTurns,
      stderr: (data: string) => chat.stderr.push(data),
      canUseTool: async (toolName, input, permission) => {
        const server = ClaudeAdapter.mcpServerOf(toolName);
        if (server === ProtocolResources.mcpServerName && !Object.isNull(request.tools) && await ClaudeAdapter.runsWithoutAskingAsync(request.tools, toolName, permission.signal))
          return { behavior: Resources.allowBehavior, updatedInput: input };
        return server !== ProtocolResources.mcpServerName && !ownServers && !Object.isNull(server) && !request.sharedServers.some(t => t.name === server)
          ? { behavior: Resources.denyBehavior, message: Resources.claudeOtherMcpToolDenied }
          : chat.decide(toolName, input, permission.signal, permission.toolUseID, permission.agentID);
      },
      permissionMode: ClaudeAdapter.startModeOf(request),
      allowDangerouslySkipPermissions: mode === Resources.bypassPermissionMode,
      perTaskStopAffordance: true,
      disallowedTools: !ownServers && Object.isNull(request.tools) && request.sharedServers.length === 0 ? [Resources.claudeMcpToolPattern] : []
    };
    if (!Object.isNull(request.requested.model))
      options.model = request.requested.model;
    if (!Object.isNull(effort))
      options.effort = effort;
    if (request.isolated) {
      options.env = { ...environment, [Resources.claudeAutoMemoryOffVariable]: Resources.enabledValue };
      options.tools = [];
      options.persistSession = false;
      options.maxTurns = 1;
      options.systemPrompt = String.empty;
    }
    const window = request.requested.contextWindow;
    options.settings = { fastMode: request.requested.speed === Resources.claudeFastSpeed, ...Object.isNull(window) ? {} : { autoCompactWindow: window } };
    if (!Object.isNull(resume))
      options.resume = resume;
    if (!Object.isNull(resume) && !Object.isNull(request.resumeAt)) {
      options.resumeSessionAt = request.resumeAt;
      options.forkSession = true;
    }

    return options;
  }


  private static async runsWithoutAskingAsync(tools: TurnTools, toolName: string, signal: AbortSignal): Promise<boolean> {
    const tool = toolName.slice(toolName.lastIndexOf(Resources.claudeMcpNameSeparator) + Resources.claudeMcpNameSeparator.length);
    return tools.approvedTools.includes(tool) || (await ReadOnlyMcpTools.listAsync(tools, signal).catch((): readonly string[] => [])).includes(tool);
  }

  private static mcpServerOf(toolName: string): string | null {
    const parts = toolName.split(Resources.claudeMcpNameSeparator);
    return parts.length === 3 && parts[0] === Resources.claudeMcpToolKind ? parts[1]! : null;
  }

  private static serversOf(request: TurnRequest, served: { url: string; token: string } | null, environment: Record<string, string | undefined>)
    : Record<string, McpServerConfig> {
    const servers: Record<string, McpServerConfig> = Object.fromEntries(request.sharedServers.map(t => [t.name,
      ClaudeAdapter.sharedServerOf(t, (variable: string) => request.sharedValues.valueOf(t.name, variable) ?? environment[variable])]));
    if (!Object.isNull(served))
      servers[ProtocolResources.mcpServerName] = { type: Resources.claudeHttpServerType, url: served.url,
        headers: { [Resources.authorizationHeader]: Resources.formatBearerValue(served.token) }, timeout: Resources.claudeToolTimeout };
    return servers;
  }

  private static sharedServerOf(server: SharedMcpServerDefinition, valueOf: (variable: string) => string | undefined): McpServerConfig {
    const command = server.command;
    if (!Object.isNull(command))
      return { type: Resources.claudeStdioServerType, command: ClaudeAdapter.launch.program, args: ClaudeAdapter.launch.argumentsOf(command, server.arguments, server.variables),
        env: ClaudeAdapter.launch.environmentOf(Object.fromEntries(server.variables.flatMap(t => ClaudeAdapter.entryOf(t, valueOf(t))))) };
    const headers: Record<string, string> = Object.fromEntries(server.headers.map(t => [t.name, Resources.formatEnvironmentReference(t.variable)]));
    if (!Object.isNull(server.bearerVariable))
      headers[Resources.authorizationHeader] = Resources.formatBearerReference(server.bearerVariable);
    return { type: Resources.claudeHttpServerType, url: server.url!, headers };
  }

  private static entryOf(variable: string, value: string | undefined): [string, string][] {
    return Object.isUndefined(value) ? [] : [[variable, value]];
  }

  private static createSystemPrompt(role: string | null): { type: "preset"; preset: "claude_code"; append?: string } {
    if (Object.isNull(role))
      return { type: Resources.presetSystemPromptType, preset: Resources.claudeCodePreset };

    return { type: Resources.presetSystemPromptType, preset: Resources.claudeCodePreset, append: role };
  }

  private static fail(error: string): TurnResult {
    return new TurnResult(TurnOutcome.Failed, null, new ObservedSettings(Resources.claudeKindId, null, null, null), error);
  }
}
