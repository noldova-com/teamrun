/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";

import "@noldova/teamrun-foundation-core";
import { JsonReader, type JsonValue } from "@noldova/teamrun-foundation-json";
import { type ForkRequest, type IProviderAdapter, type ITurnListener, SignInCheck, type TurnRequest, TurnOutcome, TurnResult } from "@noldova/teamrun-core";
import { RoleApplication, AuthStatus, ObservedSettings, type ProviderAccount, ProviderDescriptor, type ProviderModel,
  type RequestedSettings } from "@noldova/teamrun-protocol";

import type { IProcessTracker } from "../../interfaces/i-process-tracker.js";
import type { AppServerClientInfo } from "../../models/app-server-client-info.js";
import type { ProcessCommand } from "../../models/process-command.js";
import type { ProviderTimings } from "../../models/provider-timings.js";
import { Resources } from "../../resources.js";
import { AcpClient } from "../acp/acp-client.js";
import { FailureDescriber } from "../failure-describer.js";
import type { ProcessTerminator } from "../process/process-terminator.js";
import { GrokEnvironment } from "./grok-environment.js";
import { GrokModelReader } from "./grok-model.reader.js";
import { GrokProfile } from "./grok-profile.js";
import { GrokTurn } from "./grok-turn.js";

export class GrokAdapter implements IProviderAdapter {
  private readonly command: ProcessCommand | null;
  private readonly baseEnvironment: NodeJS.ProcessEnv;
  private readonly defaultProfileDirectory: string;
  private readonly clientInfo: AppServerClientInfo;
  private readonly terminator: ProcessTerminator;
  private readonly timings: ProviderTimings;
  private readonly tracker: IProcessTracker;
  private readonly clients: Set<AcpClient> = new Set();

  public readonly descriptor = new ProviderDescriptor(Resources.grokProviderId, Resources.grokDisplayName, [], true, true);

  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, defaultProfileDirectory: string, clientInfo: AppServerClientInfo,
    terminator: ProcessTerminator, timings: ProviderTimings, tracker: IProcessTracker) {
    this.command = command;
    this.baseEnvironment = environment;
    this.defaultProfileDirectory = defaultProfileDirectory;
    this.clientInfo = clientInfo;
    this.terminator = terminator;
    this.timings = timings;
    this.tracker = tracker;
  }

  public async listModels(account: ProviderAccount | null): Promise<readonly ProviderModel[]> {
    const client = this.createClient(account, null);
    try {
      return GrokModelReader.read(await this.initialize(client));
    }
    finally {
      await this.close(client);
    }
  }

  public async checkSignIn(account: ProviderAccount): Promise<SignInCheck> {
    let client: AcpClient | null = null;
    let version: string | null = null;
    try {
      client = this.createClient(account, null);
      const initialized = await this.initialize(client);
      version = GrokModelReader.version(initialized);
      if (!GrokModelReader.canAuthenticate(initialized))
        return new SignInCheck(AuthStatus.LoggedOut, null, version, Resources.formatGrokSignIn(account.profileDir));
      await this.authenticate(client);
      return new SignInCheck(AuthStatus.LoggedIn, null, version, null);
    }
    catch (error) {
      return new SignInCheck(AuthStatus.Error, null, version, FailureDescriber.describe(error));
    }
    finally {
      if (!Object.isNull(client))
        await this.close(client);
    }
  }

  public async runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult> {
    let client: AcpClient | null = null;
    let sessionId: string | null = null;
    let observed = new ObservedSettings(Resources.grokProviderId, null, null, null, null);
    let cancelTimer: NodeJS.Timeout | null = null;
    const turn = new GrokTurn(listener, signal, this.timings.streamInterval);
    const cancel = (): void => {
      if (!Object.isNull(client) && !Object.isNull(sessionId))
        client.notify(Resources.grokSessionCancel, { sessionId });
      cancelTimer ??= setTimeout(() => { void client?.stop().catch(() => undefined); }, this.timings.interruptGrace);
    };
    signal.addEventListener(Resources.abortEvent, cancel, { once: true });
    try {
      if (signal.aborted)
        return new TurnResult(TurnOutcome.Interrupted, null, observed, null);
      client = this.createClient(request.account, request.requested);
      const initialized = await this.initialize(client);
      observed = new ObservedSettings(Resources.grokProviderId, null, null, GrokModelReader.version(initialized), null);
      const models = GrokModelReader.read(initialized);
      const selected = models.find(t => t.matches(request.requested.model));
      if (request.attachments.some(t => t.isImage) && selected?.supportsImages !== true)
        throw new Error(Resources.grokImagesUnavailable);
      if (!Object.isNull(request.requested.model) && Object.isUndefined(selected))
        throw new Error(Resources.formatGrokModelUnavailable(request.requested.model));
      if (!Object.isNull(request.requested.effort) && !Object.isNullOrUndefined(selected?.effortLevels) && !selected.effortLevels.includes(request.requested.effort))
        throw new Error(Resources.formatUnknownEffort(request.requested.effort, selected.displayName));
      if (!GrokModelReader.canAuthenticate(initialized))
        throw new Error(Resources.formatGrokSignIn(request.account?.profileDir ?? this.defaultProfileDirectory));
      await this.authenticate(client);
      client.setListener(turn);
      const resumed = !Object.isNull(request.resumeNativeSessionId);
      const params: Record<string, JsonValue> = { cwd: request.workingDirectory, mcpServers: [] };
      if (!Object.isNull(request.requested.effort))
        params[Resources.grokMetaField] = { reasoningEffort: request.requested.effort };
      if (resumed)
        params[Resources.sessionIdField] = request.resumeNativeSessionId;
      const started = JsonReader.fromValue(await client.request(resumed ? Resources.grokSessionLoad : Resources.grokSessionNew, params, this.timings.initializeTimeout));
      sessionId = resumed ? request.resumeNativeSessionId : started.readNonBlankString(Resources.sessionIdField);
      const state = started.hasField(Resources.grokModelsField) ? started.readNullableObject(Resources.grokModelsField) : null;
      const switched = resumed && !Object.isNull(request.requested.model) && state?.readOptionalString(Resources.grokCurrentModelField) !== request.requested.model;
      if (switched)
        await client.request(Resources.grokSessionSetModel, { sessionId, modelId: request.requested.model });
      const meta = started.hasField(Resources.grokMetaField) ? started.readNullableObject(Resources.grokMetaField) : null;
      const model = switched ? null : state?.readOptionalString(Resources.grokCurrentModelField) ?? null;
      observed = new ObservedSettings(Resources.grokProviderId, model, meta?.readOptionalString(Resources.reasoningEffortField) ?? null, observed.harnessVersion, null);
      turn.begin(sessionId!, resumed, observed, Object.isNull(request.instructions) ? null : RoleApplication.Prompt);
      if (signal.aborted)
        cancel();
      const prompt: JsonValue[] = [{ type: Resources.textInputType, text: Resources.formatRolePrompt(request.instructions, request.prompt) }];
      for (const attachment of request.attachments.filter(t => t.isImage))
        prompt.push({ type: Resources.imageInputType, mimeType: attachment.mediaType, data: (await readFile(attachment.path)).toString(Resources.grokBase64Encoding) });
      const result = JsonReader.fromValue(await client.request(Resources.grokSessionPrompt, { sessionId, prompt }, null));
      const reason = result.readNonBlankString(Resources.grokStopReasonField);
      if (signal.aborted || reason === Resources.grokCancelled)
        return new TurnResult(TurnOutcome.Interrupted, sessionId, observed, null);
      if (reason !== Resources.grokEndTurn && reason !== Resources.grokRefusal)
        throw new Error(Resources.formatGrokStopped(reason));
      return new TurnResult(TurnOutcome.Completed, sessionId, observed, null);
    }
    catch (error) {
      return new TurnResult(signal.aborted ? TurnOutcome.Interrupted : TurnOutcome.Failed, sessionId, observed,
        signal.aborted ? null : FailureDescriber.describe(error));
    }
    finally {
      signal.removeEventListener(Resources.abortEvent, cancel);
      if (!Object.isNull(cancelTimer))
        clearTimeout(cancelTimer);
      turn.finish();
      if (!Object.isNull(client))
        await this.close(client);
    }
  }

  public forkSession(_request: ForkRequest): Promise<string> {
    return Promise.reject(new Error(Resources.forkNotSupported));
  }

  public async shutdown(): Promise<void> {
    await Promise.all([...this.clients].map(t => this.close(t)));
  }

  private createClient(account: ProviderAccount | null, requested: RequestedSettings | null): AcpClient {
    if (Object.isNull(this.command))
      throw new Error(Resources.grokNotFound);
    const profile = new GrokProfile(account?.profileDir ?? this.defaultProfileDirectory);
    profile.prepare();
    const args = [...Resources.grokAgentArguments];
    if (!Object.isNullOrUndefined(requested?.model))
      args.push(Resources.grokModelArgument, requested.model);
    if (!Object.isNullOrUndefined(requested?.effort))
      args.push(Resources.grokEffortArgument, requested.effort);
    args.push(...Resources.grokStdioArguments);
    const client = new AcpClient(this.command.withArguments(...args), GrokEnvironment.build(this.baseEnvironment, profile), profile.homeDirectory,
      this.terminator, this.timings, this.tracker);
    this.clients.add(client);
    client.start();
    return client;
  }

  private async initialize(client: AcpClient): Promise<JsonReader> {
    return JsonReader.fromValue(await client.request(Resources.grokInitialize, {
      protocolVersion: 1, clientInfo: { name: this.clientInfo.name, version: this.clientInfo.version },
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false }
    }, this.timings.initializeTimeout));
  }

  private async authenticate(client: AcpClient): Promise<void> {
    await client.request(Resources.grokAuthenticate, { methodId: Resources.grokCachedAuthMethod, _meta: { headless: true } }, this.timings.signInCheckTimeout);
  }

  private async close(client: AcpClient): Promise<void> {
    await client.stop();
    this.clients.delete(client);
  }
}
