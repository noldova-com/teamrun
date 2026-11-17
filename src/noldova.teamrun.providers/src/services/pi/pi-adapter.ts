/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";
import { Resources as CoreResources, type ForkRequest, type IProviderAdapter, type ITimer, type ITurnListener, NodeTimer, ProfileSearch, SharedMcpRefusal, SignInCheck,
  SharedMcpFailure, SharedMcpFailureKind, TurnDetail, TurnOutcome, type TurnRequest, TurnResult, TurnStart, type TurnSteer, type TurnTools } from "@noldova/teamrun.core";
import { AuthStatus, DetailKind, ForkedSession, type MessageAttachment, ObservedSettings, type OwnMcpServer, type Provider, ProviderKind, ProviderMode, ProviderModel, ProviderModelList, ProviderProfile,
  type ProviderSignInCommand, ReplyAction, type RequestedSettings, Resources as ProtocolResources, SenderEnvironment, type SharedMcpServerDefinition }
  from "@noldova/teamrun.protocol";

import { ExecutableNotFoundException } from "../../exceptions/executable-not-found.exception.js";
import { ForkUnavailableException } from "../../exceptions/fork-unavailable.exception.js";
import { ModelUnavailableException } from "../../exceptions/model-unavailable.exception.js";
import { SignInException } from "../../exceptions/sign-in.exception.js";
import { ToolsUnavailableException } from "../../exceptions/tools-unavailable.exception.js";
import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import { CommandSource } from "../../models/command-source.js";
import type { ProcessCommand } from "../../models/process-command.js";
import { ProviderAbilityTable } from "../../models/provider-ability-table.js";
import type { ProviderTimings } from "../../models/provider-timings.js";
import { Resources } from "../../resources.js";
import { AcpCommands } from "../acp/acp-commands.js";
import { CommandRefusal } from "../command-refusal.js";
import { Deadline } from "../deadline.js";
import { DeltaStream } from "../delta-stream.js";
import type { ExecutableVersionReader } from "../executables/executable-version.reader.js";
import { FailureDescriber } from "../failure-describer.js";
import { SharedMcpLaunch } from "../mcp/shared-mcp-launch.js";
import { OwnMcpServersFile } from "../own-mcp-servers-file.js";
import type { CommandRunner } from "../process/command-runner.js";
import { TerminalSignIn } from "../terminal-sign-in.js";
import { UsageValues } from "../usage-values.js";
import { UsualFolder } from "../usual-folder.js";
import { PiRpcClient } from "./pi-rpc-client.js";
import { PiTurn } from "./pi-turn.js";

export class PiAdapter implements IProviderAdapter {
  private static readonly launch: SharedMcpLaunch = new SharedMcpLaunch();

  public readonly descriptor: ProviderKind;
  public readonly profileSearch: ProfileSearch = new ProfileSearch([], [Resources.piAuthFile]);
  public readonly modes: readonly ProviderMode[] = [
    new ProviderMode(Resources.piAskMode, Resources.piAskModeName, Resources.piAskModeDescription),
    new ProviderMode(Resources.piReadOnlyMode, Resources.piReadOnlyModeName, Resources.piReadOnlyModeDescription, false, true),
    new ProviderMode(Resources.piAllowAllMode, Resources.piAllowAllModeName, Resources.piAllowAllModeDescription, true)];
  public readonly defaultMode: string = Resources.piAskMode;
  public readonly explorerMode: string = Resources.piReadOnlyMode;
  public readonly planMode: string | null = null;
  public readonly takesTeamRunTools: boolean = true;
  public readonly backgroundSubAgentsNote: string | null = null;
  private readonly commands: CommandSource;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly usualFolder: string;
  private readonly extensionDirectory: string;
  private readonly starter: IProcessStarter;
  private readonly runner: CommandRunner;
  private readonly timings: ProviderTimings;
  private readonly versionReader: ExecutableVersionReader;
  private readonly promptTimeout: number;
  private readonly idleTimer: ITimer;
  private readonly clients: Set<PiRpcClient> = new Set();
  private readonly running: Set<string> = new Set();
  private readonly closing: Set<string> = new Set();
  private readonly sessionsWithoutChat: Set<string> = new Set();
  private readonly kept: Map<PiRpcClient, { readonly key: string; readonly sessionFile: string; readonly sender: string | null; readonly idle: Deadline }> =
    new Map();
  private readonly models: Map<string, readonly ProviderModel[]> = new Map();
  private readonly tokens: Map<PiRpcClient, { readonly token: string; readonly revoke: () => void }> = new Map();
  private readonly listing: Set<PiRpcClient> = new Set();
  private versionCheck: { readonly stamp: string | null; readonly unsupported: string | null } | null = null;

  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, extensionDirectory: string, starter: IProcessStarter,
    runner: CommandRunner, timings: ProviderTimings, versionReader: ExecutableVersionReader, locate: () => ProcessCommand | null = CommandSource.none,
    promptTimeout: number = Resources.piCompactTimeout, idleTimer: ITimer = new NodeTimer()) {
    this.usualFolder = UsualFolder.of(environment, Resources.piAgentDirectoryVariable, Resources.piAgentDirectoryName);
    this.descriptor = new ProviderKind(Resources.piKindId, Resources.piDisplayName, true, false, null,
      new ProviderProfile(Resources.piAgentDirectoryVariable, Resources.piSignInCommand, this.usualFolder, Resources.piSignInCommand),
      false, Resources.toolLogoutCommand, false, null, false, null, ProviderAbilityTable.pi);
    this.commands = new CommandSource(command, locate);
    this.environment = environment;
    this.extensionDirectory = extensionDirectory;
    this.starter = starter;
    this.runner = runner;
    this.timings = timings;
    this.versionReader = versionReader;
    this.promptTimeout = promptTimeout;
    this.idleTimer = idleTimer;
  }

  public async readSignInCommand(_provider: Provider): Promise<ProviderSignInCommand | null> {
    return TerminalSignIn.of(this.commands.current, Resources.piSignInCommand, await this.runner.readEnvironmentAsync(this.environment));
  }

  public async checkSignIn(provider: Provider): Promise<SignInCheck> {
    const command = this.commands.current;
    if (Object.isNull(command))
      return new SignInCheck(AuthStatus.Error, null, null, Resources.piNotFound);
    const environment = this.environmentFor(provider, null);
    const version = await this.versionReader.read(command, environment);
    const unsupported = PiAdapter.formatUnsupported(version);
    if (!Object.isNull(unsupported))
      return new SignInCheck(AuthStatus.Error, null, version, unsupported);
    const defaultProvider = this.readDefaultProvider(provider) ?? await this.readStartingProvider(provider);
    if (Object.isNull(defaultProvider))
      return new SignInCheck(AuthStatus.LoggedOut, null, version, Resources.piChooseModel);
    const result = await this.runner.run(command.withArguments(...Resources.piAuthCheckArguments, defaultProvider, Resources.piJsonArgument), environment,
      this.timings.signInCheckTimeout);
    if (result.exitCode === 0)
      return new SignInCheck(AuthStatus.LoggedIn, null, version, null);
    return result.exitCode === 1 && !result.timedOut ? new SignInCheck(AuthStatus.LoggedOut, null, version, Resources.formatPiNotReady(defaultProvider))
      : new SignInCheck(AuthStatus.Error, null, version, Resources.formatPiAuthInvalid(defaultProvider, result.timedOut));
  }

  public listOwnMcpServers(provider: Provider | null): Promise<readonly OwnMcpServer[]> {
    return OwnMcpServersFile.listInAsync(join(provider?.profileDir ?? this.usualFolder, Resources.ownMcpFile));
  }

  public signIn(_provider: Provider, _signal: AbortSignal): Promise<void> {
    return Promise.reject(new SignInException(Resources.piSignInUnavailable));
  }

  public async listModels(provider: Provider | null, refresh: boolean = false): Promise<ProviderModelList> {
    const key = provider?.profileDir ?? this.usualFolder;
    const kept = refresh ? undefined : this.models.get(key);
    if (!Object.isUndefined(kept))
      return this.modelList(kept);
    const client = this.open(provider, null, null, [Resources.piNoSessionArgument, ...Resources.piSetupOffArguments]);
    try {
      const listed = await client.request(Resources.piGetModelsCommand, {}, this.timings.requestTimeout);
      const state = await client.request(Resources.piGetStateCommand, {}, this.timings.requestTimeout);
      const current = state.hasField(Resources.modelField) ? state.readNullableObject(Resources.modelField) : null;
      const models = listed.readObjectArray(Resources.piModelsField).map(t => PiAdapter.toModel(t, current));
      if (models.length > 0)
        this.models.set(key, models);
      return this.modelList(models);
    }
    finally {
      await this.close(client);
    }
  }

  public askIsolated(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult | null> {
    return this.runTurn(request, listener, signal);
  }

  public async runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult> {
    const resume = request.resumeNativeSessionId;
    let observed = new ObservedSettings(Resources.piKindId, null, null, null);
    const refused = CommandRefusal.of(this.descriptor.displayName, request, t => Resources.piBuiltInCommandNames.includes(t) ? Resources.piBuiltInCommandsAbility : null);
    if (!Object.isNull(refused)) {
      await listener.onDetailAsync(new TurnDetail(DetailKind.Note, refused, null, null));
      return new TurnResult(TurnOutcome.Completed, resume, observed, null);
    }
    const command = request.compacts || request.attachments.length > 0 ? null : request.command;
    if (request.compacts && Object.isNull(resume)) {
      await listener.onDetailAsync(new TurnDetail(DetailKind.Note, CoreResources.nothingToCompact, null, null));
      return new TurnResult(TurnOutcome.Completed, null, observed, null);
    }
    const stream = new DeltaStream(listener, this.timings.streamInterval);
    let client: PiRpcClient | null = null;
    let sessionFile: string | null = resume;
    let keeps = false;
    let running = true;
    let sender: string | null = null;
    const shared = PiAdapter.sharedVariablesOf(request.sharedServers);
    const key = JSON.stringify([request.provider?.id ?? null, request.requested.mode,
      Object.entries(request.environment).filter(([name]) => name !== ProtocolResources.senderTokenVariable), request.workingDirectory, shared]);
    const turn = new PiTurn(listener, stream, message => client!.send(message), request.tools?.approvedTools ?? []);
    const abort = (): void => {
      turn.settle(TurnOutcome.Interrupted);
      client!.request(Resources.piAbortCommand, {}, this.timings.interruptTimeout).catch(() => undefined);
    };
    try {
      const unsupported = await this.unsupportedVersion(request.provider, signal);
      if (signal.aborted)
        return new TurnResult(TurnOutcome.Interrupted, resume, observed, null);
      if (!Object.isNull(unsupported))
        return new TurnResult(TurnOutcome.Failed, resume, observed, unsupported);
      const taken = await this.take(key, resume, request);
      sender = Object.isNull(taken) ? SenderEnvironment.read(request.environment) : taken.sender;
      const served = Object.isNull(taken) && !request.isolated ? PiAdapter.serve(request.tools) : null;
      try {
        client = taken?.client ?? this.open(request.provider, request.requested.mode, { ...request.environment, ...served?.variables, ...shared }, request.isolated
          ? [Resources.piNoSessionArgument, Resources.piNoToolsArgument, Resources.piNoExtensionsArgument,
            ...Resources.piBuiltInProviderExtensions.flatMap(t => [Resources.piExtensionArgument, t]), ...Resources.piSetupOffArguments]
          : [Resources.piExtensionArgument, this.writeExtension(), ...Object.isNull(resume) ? [] : [Resources.piSessionArgument, resume]], request.workingDirectory);
      }
      catch (error) {
        served?.revoke();
        throw error;
      }
      const current = client;
      if (!Object.isNull(served))
        this.tokens.set(client, served);
      client.listen(event => turn.handle(event));
      signal.addEventListener(Resources.abortEvent, abort, { once: true });
      observed = await this.configure(client, request.requested);
      const state = await client.request(Resources.piGetStateCommand, {}, this.timings.requestTimeout);
      sessionFile = state.readNonBlankString(request.isolated ? Resources.piSessionIdField : Resources.piSessionFileField);
      const alone = Object.isNull(command) ? null : (await client.request(Resources.piGetCommandsCommand, {}, this.timings.requestTimeout))
        .readObjectArray(Resources.piCommandsField).some(t => t.readNonBlankString(Resources.nameField) === AcpCommands.nameOf(command)) ? command : null;
      this.running.add(sessionFile);
      await listener.onStartedAsync(new TurnStart(sessionFile, !Object.isNull(resume)));
      await listener.onObservedAsync(observed);
      if (signal.aborted)
        return new TurnResult(TurnOutcome.Interrupted, sessionFile, observed, null);
      if (request.compacts) {
        await Promise.race([turn.waitForSettled(), client.request(Resources.piCompactCommand, {}, Resources.piCompactTimeout)]);
        await turn.drainAsync();
        keeps = !signal.aborted;
        return new TurnResult(signal.aborted ? TurnOutcome.Interrupted : TurnOutcome.Completed, sessionFile, observed, null);
      }
      const prompt = await PiAdapter.messageOf(alone ?? Resources.formatRolePrompt(request.instructions, Object.isNull(resume) || this.sessionsWithoutChat.delete(resume)
        ? request.freshPrompt ?? request.prompt : request.prompt), request.attachments);
      if (!Object.isNull(alone) && Object.isNull(resume))
        this.sessionsWithoutChat.add(sessionFile);
      if (signal.aborted)
        return new TurnResult(TurnOutcome.Interrupted, sessionFile, observed, null);
      await Promise.race([turn.waitForSettled(), client.request(Resources.piPromptCommand, prompt, this.promptTimeout).then(accepted => {
        if (accepted.readOptionalString(Resources.piDispositionField) === Resources.piHandledDisposition)
          turn.settle(TurnOutcome.Completed);
        else
          listener.onSteerable?.(t => running ? this.steer(current, t) : Promise.resolve(false));
      })]);
      await Promise.race([turn.waitForSettled(), client.waitForExit().then(exit => turn.settle(TurnOutcome.Failed,
        Resources.formatPiExited(exit.code, exit.signal, current.stderr)))]);
      await turn.drainAsync();
      const stats = await client.request(Resources.piGetStatsCommand, {}, this.timings.requestTimeout).catch(() => null);
      const context = Object.isNull(stats) || !stats.hasField(Resources.piContextUsageField) ? null : UsageValues.context(
        UsageValues.fieldOf(stats.toJson(), Resources.piContextUsageField, Resources.piTokensField),
        UsageValues.fieldOf(stats.toJson(), Resources.piContextUsageField, Resources.piContextWindowField));
      if (turn.hasUsage)
        await listener.onUsageAsync(turn.usage(context));
      const turnId = await this.lastUserEntry(client).catch(() => null);
      const outcome = signal.aborted ? TurnOutcome.Interrupted : turn.outcome!;
      const tools = request.tools;
      if (outcome === TurnOutcome.Completed && !Object.isNull(tools))
        await this.noteUnlistedToolsAsync(current, tools, request, listener);
      keeps = outcome === TurnOutcome.Completed && !request.isolated;
      return new TurnResult(outcome, sessionFile, observed, outcome === TurnOutcome.Failed ? turn.error : null, turnId);
    }
    catch (error) {
      return new TurnResult(signal.aborted ? TurnOutcome.Interrupted : TurnOutcome.Failed, sessionFile, observed, signal.aborted ? null : FailureDescriber.describe(error),
        null, !signal.aborted && error instanceof ModelUnavailableException ? ReplyAction.ChooseModel : null);
    }
    finally {
      running = false;
      listener.onSteerable?.(null);
      signal.removeEventListener(Resources.abortEvent, abort);
      try {
        await turn.finishAsync();
      }
      finally {
        if (!Object.isNull(client))
          await this.release(client, keeps ? key : null, sessionFile, sender);
      }
    }
  }

  public async closeSessions(nativeSessionIds: readonly string[]): Promise<void> {
    for (const sessionFile of nativeSessionIds.filter(t => this.running.has(t)))
      this.closing.add(sessionFile);
    await Promise.all([...this.kept].filter(([, t]) => nativeSessionIds.includes(t.sessionFile)).map(([client]) => this.close(client)));
  }

  private async take(key: string, resume: string | null, request: TurnRequest): Promise<{ readonly client: PiRpcClient; readonly sender: string | null } | null> {
    const kept = [...this.kept].find(([, t]) => t.sessionFile === resume);
    if (Object.isUndefined(kept))
      return null;
    const [client, held] = kept;
    this.kept.delete(client);
    held.idle.stop();
    const sender = SenderEnvironment.read(request.environment);
    const token = this.tokens.get(client)?.token ?? null;
    if (held.key === key && client.isAlive && Object.isNull(sender) === Object.isNull(held.sender) && Object.isNull(request.tools) === Object.isNull(token)
      && (Object.isNull(held.sender) || request.adoptSender(held.sender)) && (Object.isNull(token) || request.tools?.adopt(token) === true))
      return { client, sender: held.sender };
    await this.close(client);
    return null;
  }

  private async release(client: PiRpcClient, key: string | null, sessionFile: string | null, sender: string | null): Promise<void> {
    client.listen(null);
    let closing = false;
    if (!Object.isNull(sessionFile)) {
      this.running.delete(sessionFile);
      closing = this.closing.delete(sessionFile);
    }
    if (Object.isNull(key) || Object.isNull(sessionFile) || closing || !client.isAlive || !this.clients.has(client)) {
      await this.close(client);
      return;
    }
    const idle = new Deadline(this.idleTimer, this.timings.idleLimit, () => void this.close(client).catch(() => undefined));
    this.kept.set(client, { key, sessionFile, sender, idle });
    idle.start();
  }

  private async steer(client: PiRpcClient, steer: TurnSteer): Promise<boolean> {
    try {
      await client.request(Resources.piSteerCommand, await PiAdapter.messageOf(steer.text, steer.attachments), this.timings.requestTimeout);
      return true;
    }
    catch {
      return false;
    }
  }

  private static async messageOf(text: string, attachments: readonly MessageAttachment[]): Promise<JsonObject> {
    const images = await Promise.all(attachments.filter(t => t.isImage).map(async t => ({ type: Resources.piImageType, mimeType: t.mediaType,
      data: (await readFile(t.path)).toString(Resources.piBase64Encoding) })));
    return { message: text, ...images.length > 0 ? { [Resources.piImagesField]: images } : {} };
  }

  public async forkSession(request: ForkRequest): Promise<ForkedSession> {
    const client = this.open(request.provider, null, null, [...Resources.piSetupOffArguments, Resources.piSessionArgument, request.nativeSessionId],
      request.workingDirectory);
    try {
      const messages = (await client.request(Resources.piGetForkMessagesCommand, {}, this.timings.requestTimeout)).readObjectArray(Resources.piMessagesField)
        .map(t => t.readNonBlankString(Resources.piEntryIdField));
      const index = messages.indexOf(request.lastTurnId);
      if (index < 0)
        throw new ForkUnavailableException(Resources.formatPiTurnNotFound(request.lastTurnId));
      const next = messages[index + 1];
      const forked = Object.isUndefined(next) ? await client.request(Resources.piCloneCommand, {}, this.timings.requestTimeout)
        : await client.request(Resources.piForkCommand, { entryId: next }, this.timings.requestTimeout);
      if (forked.hasField(Resources.piCancelledField) && forked.readValue(Resources.piCancelledField) === true)
        throw new ForkUnavailableException(Resources.piForkCancelled);
      const state = await client.request(Resources.piGetStateCommand, {}, this.timings.requestTimeout);
      return new ForkedSession(Resources.piKindId, request.provider?.id ?? null, state.readNonBlankString(Resources.piSessionFileField));
    }
    finally {
      await this.close(client);
    }
  }

  public sharedServerUnavailable(server: SharedMcpServerDefinition): SharedMcpRefusal | null {
    const own = server.referencedVariables.find(t => t.toUpperCase().startsWith(Resources.piOwnVariablePrefix));
    return Object.isUndefined(own)
      ? PiAdapter.launch.refusalOf(server, Resources.piDisplayName)
      : new SharedMcpRefusal(Resources.formatPiOwnVariableWithheld(own), Resources.formatSharedMcpVariableWithheldShort(own));
  }

  public sharedServerNamespaceOf(name: string): string {
    return name.replaceAll("-", "_");
  }

  public savedSecretsUnavailable(): SharedMcpRefusal {
    return new SharedMcpRefusal(Resources.formatSavedSecretsFromEnvironmentOnly(Resources.piDisplayName), Resources.savedSecretsFromEnvironmentOnlyShort);
  }

  public async shutdown(): Promise<void> {
    await Promise.all([...this.clients].map(t => this.close(t)));
  }

  private open(provider: Provider | null, mode: string | null, environment: Readonly<Record<string, string>> | null, args: readonly string[],
    directory: string | null = null): PiRpcClient {
    const command = this.commands.current;
    if (Object.isNull(command))
      throw new ExecutableNotFoundException(Resources.piNotFound);
    const client = new PiRpcClient(command.withArguments(Resources.piModeArgument, Resources.piRpcMode, ...args), this.environmentFor(provider, mode, environment),
      directory, this.starter, this.timings.stopGrace);
    client.start(null);
    this.clients.add(client);
    return client;
  }

  private async noteUnlistedToolsAsync(client: PiRpcClient, tools: TurnTools, request: TurnRequest, listener: ITurnListener): Promise<void> {
    if (tools.isListed)
      this.listing.add(client);
    if (!this.listing.has(client))
      await listener.onSharedServerFailedAsync(new SharedMcpFailure(request.provider?.id ?? Resources.piKindId, request.provider?.label ?? Resources.piDisplayName,
        ProtocolResources.mcpServerName, SharedMcpFailureKind.Unlisted, Resources.piTeamRunToolsUnlisted));
  }

  private async close(client: PiRpcClient): Promise<void> {
    this.kept.get(client)?.idle.stop();
    this.kept.delete(client);
    this.tokens.get(client)?.revoke();
    this.tokens.delete(client);
    this.listing.delete(client);
    this.clients.delete(client);
    await client.stop();
  }

  private async configure(client: PiRpcClient, requested: RequestedSettings): Promise<ObservedSettings> {
    const model = requested.model;
    if (!Object.isNull(model)) {
      const separator = model.indexOf(Resources.piModelSeparator);
      await client.request(Resources.piSetModelCommand, { provider: model.slice(0, separator), modelId: model.slice(separator + 1) }, this.timings.requestTimeout)
        .catch((error: unknown) => {
          throw new ModelUnavailableException(Resources.formatModelUnavailable(Resources.piDisplayName, `${model} (${FailureDescriber.describe(error)})`));
        });
    }
    if (!Object.isNull(requested.effort))
      await client.request(Resources.piSetThinkingCommand, { level: requested.effort }, this.timings.requestTimeout);
    const state = await client.request(Resources.piGetStateCommand, {}, this.timings.requestTimeout);
    const current = state.hasField(Resources.modelField) ? state.readNullableObject(Resources.modelField) : null;
    return new ObservedSettings(Resources.piKindId, Object.isNull(current) ? null : PiAdapter.idOf(current),
      state.readOptionalString(Resources.piThinkingLevelField) ?? null, null);
  }

  private async lastUserEntry(client: PiRpcClient): Promise<string | null> {
    const messages = (await client.request(Resources.piGetForkMessagesCommand, {}, this.timings.requestTimeout)).readObjectArray(Resources.piMessagesField);
    return messages.at(-1)?.readNonBlankString(Resources.piEntryIdField) ?? null;
  }

  private static sharedVariablesOf(servers: readonly SharedMcpServerDefinition[]): Readonly<Record<string, string>> {
    return servers.length === 0 ? {}
      : { [Resources.piSharedServersVariable]: JSON.stringify(Object.fromEntries(servers.map(t => [t.name, PiAdapter.sharedServerOf(t)]))) };
  }

  private static sharedServerOf(server: SharedMcpServerDefinition): Readonly<Record<string, unknown>> {
    const command = server.command;
    if (!Object.isNull(command))
      return { command: PiAdapter.launch.program, args: PiAdapter.launch.argumentsOf(command, server.arguments, server.variables),
        env: PiAdapter.launch.environmentOf({}), exposure: Resources.piDirectExposure };
    const headers: Record<string, string> = Object.fromEntries(server.headers.map(t => [t.name, Resources.formatEnvironmentReference(t.variable)]));
    if (!Object.isNull(server.bearerVariable))
      headers[Resources.authorizationHeader] = Resources.formatBearerReference(server.bearerVariable);
    return { url: server.url, headers, exposure: Resources.piDirectExposure };
  }

  private static serve(tools: TurnTools | null): { readonly token: string; readonly revoke: () => void; readonly variables: Readonly<Record<string, string>> } | null {
    if (Object.isNull(tools))
      return null;
    const endpoint = tools.endpoint;
    if (Object.isNull(endpoint))
      throw new ToolsUnavailableException(Resources.formatToolsNotServed(Resources.piDisplayName));
    const token = endpoint.issueKept();
    return { token, revoke: () => endpoint.revoke(token),
      variables: { [Resources.piToolsUrlVariable]: endpoint.url, [Resources.piToolsTokenVariable]: token } };
  }

  private environmentFor(provider: Provider | null, mode: string | null, extra: Readonly<Record<string, string>> | null = null): NodeJS.ProcessEnv {
    return { ...this.environment, [Resources.piToolsUrlVariable]: String.empty, [Resources.piToolsTokenVariable]: String.empty,
      [Resources.piSharedServersVariable]: String.empty, ...extra,
      [Resources.piAgentDirectoryVariable]: provider?.profileDir ?? this.usualFolder,
      [Resources.piModeVariable]: mode ?? Resources.piAskMode };
  }

  private readDefaultProvider(provider: Provider): string | null {
    try {
      const settings = JsonReader.parse(readFileSync(join(provider.profileDir, Resources.piSettingsFile), Resources.utf8Encoding));
      const value = settings.hasField(Resources.piDefaultProviderField) ? settings.readValue(Resources.piDefaultProviderField) : null;
      return Object.isString(value) && !String.isNullOrWhitespace(value) ? value : null;
    }
    catch {
      return null;
    }
  }

  private async readStartingProvider(provider: Provider): Promise<string | null> {
    const client = this.open(provider, null, null, [Resources.piNoSessionArgument, ...Resources.piSetupOffArguments]);
    try {
      const state = await client.request(Resources.piGetStateCommand, {}, this.timings.signInCheckTimeout);
      const starting = state.hasField(Resources.modelField) ? state.readObject(Resources.modelField).readNonBlankString(Resources.providerField) : null;
      return starting === Resources.piUnknownProvider ? null : starting;
    }
    catch {
      return null;
    }
    finally {
      await this.close(client);
    }
  }

  private async unsupportedVersion(provider: Provider | null, signal: AbortSignal): Promise<string | null> {
    const command = this.commands.current;
    if (Object.isNull(command))
      return null;
    const stamp = this.versionReader.readStamp(command);
    if (this.versionCheck?.stamp === stamp)
      return this.versionCheck.unsupported;
    const version = await this.versionReader.read(command, this.environmentFor(provider, null), signal);
    const unsupported = PiAdapter.formatUnsupported(version);
    if (!Object.isNull(version))
      this.versionCheck = { stamp, unsupported };
    return unsupported;
  }

  private writeExtension(): string {
    const path = join(this.extensionDirectory, Resources.piExtensionFile);
    if (PiAdapter.holdsExtension(path))
      return path;
    mkdirSync(this.extensionDirectory, { recursive: true });
    const temporary = `${path}.${randomUUID()}`;
    try {
      writeFileSync(temporary, Resources.piApprovalsExtension, { flag: "wx", mode: 0o600 });
      renameSync(temporary, path);
    }
    finally {
      rmSync(temporary, { force: true });
    }
    return path;
  }

  private modelList(models: readonly ProviderModel[]): ProviderModelList {
    return new ProviderModelList(models, null, models.length === 0, null, false, this.modes, this.defaultMode);
  }

  private static toModel(model: JsonReader, current: JsonReader | null): ProviderModel {
    const id = PiAdapter.idOf(model);
    const input = model.hasField(Resources.inputField) ? model.readValue(Resources.inputField) : null;
    return new ProviderModel(id, model.readOptionalString(Resources.nameField) ?? id, model.readNonBlankString(Resources.providerField),
      model.hasField(Resources.piReasoningField) && model.readValue(Resources.piReasoningField) === true ? PiAdapter.levelsOf(model) : null,
      !Object.isNull(current) && PiAdapter.idOf(current) === id, null, Array.isArray(input) && input.includes(Resources.piImageType));
  }

  private static holdsExtension(path: string): boolean {
    try {
      return readFileSync(path, Resources.utf8Encoding) === Resources.piApprovalsExtension;
    }
    catch {
      return false;
    }
  }

  private static levelsOf(model: JsonReader): readonly string[] {
    const map = UsageValues.objectOf(model.toJson()[Resources.piThinkingLevelMapField]) ?? {};
    return [...Resources.piThinkingLevels.filter(t => map[t] !== null), ...Resources.piExtendedThinkingLevels.filter(t => !Object.isNullOrUndefined(map[t]))];
  }

  private static idOf(model: JsonReader): string {
    return `${model.readNonBlankString(Resources.providerField)}${Resources.piModelSeparator}${model.readNonBlankString(Resources.idField)}`;
  }

  private static formatUnsupported(version: string | null): string | null {
    const parts = Object.isNull(version) ? null : Resources.piVersionPattern.exec(version);
    if (Object.isNull(parts))
      return null;
    const numbers = parts.slice(1).map(t => Number.parseInt(t, 10));
    const older = Resources.piMinimumVersion.findIndex((t, i) => numbers[i] !== t);
    return older >= 0 && numbers[older]! < Resources.piMinimumVersion[older]! ? Resources.formatPiUnsupported(version!) : null;
  }
}
