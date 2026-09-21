/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync } from "node:fs";

import "@noldova/teamrun-foundation-core";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";
import {
  type ForkRequest,
  type IProviderAdapter,
  type ITurnListener,
  SignInCheck,
  TurnDetail,
  type TurnRequest,
  TurnOutcome,
  TurnResult,
  TurnStart
} from "@noldova/teamrun-core";
import { RoleApplication,
  AuthStatus,
  DetailKind,
  ObservedSettings,
  type ProviderAccount,
  type ProviderAccountIdentity,
  ProviderDescriptor,
  type ProviderModel,
  type RequestedSettings
} from "@noldova/teamrun-protocol";

import { ExecutableNotFoundException } from "../../exceptions/executable-not-found.exception.js";
import type { IExitHandler } from "../../interfaces/i-exit-handler.js";
import type { IProcessTracker } from "../../interfaces/i-process-tracker.js";
import type { AppServerClientInfo } from "../../models/app-server-client-info.js";
import { CodexAccount } from "../../models/codex-account.js";
import type { ProcessCommand } from "../../models/process-command.js";
import type { ProviderTimings } from "../../models/provider-timings.js";
import { ThreadStartResult } from "../../models/thread-start-result.js";
import { Resources } from "../../resources.js";
import { FailureDescriber } from "../failure-describer.js";
import { AbortTimer } from "../process/abort-timer.js";
import type { ProcessTerminator } from "../process/process-terminator.js";
import { AppServerClient } from "./app-server-client.js";
import { CodexEnvironment } from "./codex-environment.js";
import { CodexItemReader } from "./codex-item.reader.js";
import { CodexRequestRouter } from "./codex-request-router.js";
import { DeltaStream } from "../delta-stream.js";
import { CodexTurn } from "./codex-turn.js";
import { CodexModelReader } from "./codex-model.reader.js";

export class CodexAdapter implements IProviderAdapter {
  public readonly descriptor: ProviderDescriptor;
  private readonly command: ProcessCommand | null;
  private readonly baseEnvironment: NodeJS.ProcessEnv;
  private readonly clientInfo: AppServerClientInfo;
  private readonly terminator: ProcessTerminator;
  private readonly timings: ProviderTimings;
  private readonly tracker: IProcessTracker;
  private readonly router: CodexRequestRouter = new CodexRequestRouter();
  private readonly itemReader: CodexItemReader = new CodexItemReader();
  private readonly clients: Map<string, Promise<AppServerClient>> = new Map();

  public constructor(
    command: ProcessCommand | null,
    baseEnvironment: NodeJS.ProcessEnv,
    clientInfo: AppServerClientInfo,
    terminator: ProcessTerminator,
    timings: ProviderTimings,
    tracker: IProcessTracker) {
    this.tracker = tracker;
    this.descriptor = new ProviderDescriptor(Resources.codexProviderId, Resources.codexDisplayName, Resources.codexEffortLevels, true, true, true);
    this.command = command;
    this.baseEnvironment = baseEnvironment;
    this.clientInfo = clientInfo;
    this.terminator = terminator;
    this.timings = timings;
  }

  public get clientCount(): number {
    return this.clients.size;
  }

  public async checkSignIn(account: ProviderAccount): Promise<SignInCheck> {
    try {
      const client = await this.connect(account);
      const codexAccount = await this.readAccount(client);
      if (Object.isNull(codexAccount))
        return new SignInCheck(AuthStatus.LoggedOut, null, client.version, null);

      return new SignInCheck(AuthStatus.LoggedIn, codexAccount.toIdentity(), client.version, null);
    }
    catch (error) {
      return new SignInCheck(AuthStatus.Error, null, null, FailureDescriber.describe(error));
    }
  }

  public async listModels(account: ProviderAccount | null): Promise<readonly ProviderModel[]> {
    const client = await this.connect(account);
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
    throw new Error(Resources.modelCatalogTooLarge);
  }

  public async runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult> {
    const effort = request.requested.effort;
    let client: AppServerClient;
    try {
      client = await this.connect(request.account);
      if (!Object.isNull(effort)) {
        const model = (await this.listModels(request.account)).find(t => t.matches(request.requested.model));
        if (!Object.isNullOrUndefined(model?.effortLevels) && !model.effortLevels.includes(effort))
          return CodexAdapter.fail(Resources.formatUnknownEffort(effort, model.displayName), null, null);
      }
    }
    catch (error) {
      return CodexAdapter.fail(FailureDescriber.describe(error), null, null);
    }

    const identity = await this.readIdentity(client, listener);
    let started: ThreadStartResult;
    try {
      started = await this.openThread(client, request, listener);
    }
    catch (error) {
      return CodexAdapter.fail(FailureDescriber.describe(error), client.version, identity);
    }

    const observed = new ObservedSettings(this.descriptor.id, started.model, started.reasoningEffort, client.version, identity);
    listener.onStarted(new TurnStart(started.threadId, started.threadId === request.resumeNativeSessionId,
      Object.isNull(request.instructions) ? null : RoleApplication.Instructions));
    listener.onObserved(observed);

    const turn = new CodexTurn(started.threadId, listener, observed, this.itemReader, new DeltaStream(listener, this.timings.streamInterval));
    return this.runTurnOnThread(client, turn, request, signal);
  }

  public async forkSession(request: ForkRequest): Promise<string> {
    const client = await this.connect(request.account);
    const params = {
      ...CodexAdapter.createThreadParams(request.workingDirectory, request.requested),
      [Resources.threadIdField]: request.nativeSessionId,
      [Resources.lastTurnIdField]: request.lastTurnId
    };
    const forked = await this.openExisting(client, Resources.threadForkMethod, params, request.nativeSessionId);

    return forked.threadId;
  }

  public async shutdown(): Promise<void> {
    const starting = [...this.clients.values()];
    this.clients.clear();
    for (const promise of starting) {
      let client: AppServerClient;
      try {
        client = await promise;
      }
      catch {
        continue;
      }
      await client.stop();
    }
  }

  private async runTurnOnThread(client: AppServerClient, turn: CodexTurn, request: TurnRequest, signal: AbortSignal): Promise<TurnResult> {
    this.router.register(turn);
    const notifications = client.subscribe(turn);
    const exits = client.subscribeExit(CodexAdapter.createExitHandler(turn));
    const grace = new AbortTimer(signal, this.timings.interruptGrace);
    const onAbort = (): void => this.interrupt(client, turn);
    signal.addEventListener(Resources.abortEvent, onAbort, { once: true });
    try {
      const params = { threadId: turn.threadId, input: [
        { type: Resources.textInputType,
          text: turn.threadId === request.resumeNativeSessionId ? request.prompt : request.freshPrompt ?? request.prompt, text_elements: [] },
        ...request.attachments.filter(t => t.isImage).map(t => ({ type: Resources.localImageInputType, path: t.path }))
      ] };
      const response = JsonReader.fromValue(await client.request(Resources.turnStartMethod, params, this.timings.requestTimeout), Resources.resultPath);
      turn.begin(response.readObject(Resources.turnField).readNonBlankString(Resources.idField));
      if (signal.aborted)
        this.interrupt(client, turn);
      await Promise.race([turn.waitForCompletion(), grace.wait()]);
      if (grace.elapsed)
        turn.interrupt();
    }
    catch (error) {
      turn.fail(FailureDescriber.describe(error));
    }
    finally {
      signal.removeEventListener(Resources.abortEvent, onAbort);
      grace[Symbol.dispose]();
      exits[Symbol.dispose]();
      notifications[Symbol.dispose]();
      this.router.unregister(turn);
    }

    return turn.toResult(signal.aborted);
  }

  private connect(account: ProviderAccount | null): Promise<AppServerClient> {
    const key = Object.isNull(account) ? Resources.defaultProfileKey : account.id;
    const existing = this.clients.get(key);
    if (!Object.isUndefined(existing))
      return existing;

    const starting = this.startClient(Object.isNull(account) ? null : account.profileDir);
    this.clients.set(key, starting);
    void starting.then(
      client => client.subscribeExit(this.createForgetHandler(key, starting)),
      () => this.forget(key, starting));

    return starting;
  }

  private async startClient(profileDir: string | null): Promise<AppServerClient> {
    if (Object.isNull(this.command))
      throw new ExecutableNotFoundException(Resources.codexNotFound);
    if (!Object.isNull(profileDir))
      mkdirSync(profileDir, { recursive: true });

    const environment = CodexEnvironment.build(this.baseEnvironment, profileDir);
    const client = new AppServerClient(
      this.command.withArguments(Resources.appServerArgument), environment, this.clientInfo, this.terminator, this.timings, this.tracker);
    client.setServerRequestHandler(this.router);
    await client.start();

    return client;
  }

  private forget(key: string, starting: Promise<AppServerClient>): void {
    if (this.clients.get(key) === starting)
      this.clients.delete(key);
  }

  private createForgetHandler(key: string, starting: Promise<AppServerClient>): IExitHandler {
    return { handleExit: () => this.forget(key, starting) };
  }

  private async openThread(client: AppServerClient, request: TurnRequest, listener: ITurnListener): Promise<ThreadStartResult> {
    const params = CodexAdapter.createThreadParams(request.workingDirectory, request.requested, request.instructions);
    const resumeId = request.resumeNativeSessionId;
    if (Object.isNull(resumeId))
      return this.startThread(client, params);

    try {
      return await this.resumeThread(client, params, resumeId);
    }
    catch (error) {
      listener.onDetail(new TurnDetail(DetailKind.Note, Resources.formatResumeFailed(FailureDescriber.describe(error)), null, null));
      return this.startThread(client, params);
    }
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

  private static createThreadParams(workingDirectory: string, requested: RequestedSettings, instructions: string | null = null): JsonObject {
    const config: { [key: string]: JsonObject | string | boolean } = { mcp_servers: {}, plugins: {}, features: { plugins: false } };
    if (!Object.isNull(requested.effort))
      config[Resources.modelReasoningEffortSetting] = requested.effort;

    return {
      cwd: workingDirectory,
      model: requested.model,
      sandbox: Resources.workspaceWriteSandbox,
      approvalPolicy: Resources.onRequestApprovalPolicy,
      ephemeral: false,
      developerInstructions: instructions ?? String.empty,
      config
    };
  }

  private async readIdentity(client: AppServerClient, listener: ITurnListener): Promise<ProviderAccountIdentity | null> {
    try {
      const account = await this.readAccount(client);
      return Object.isNull(account) ? null : account.toIdentity();
    }
    catch (error) {
      listener.onDetail(new TurnDetail(DetailKind.Note, Resources.formatAccountUnavailable(FailureDescriber.describe(error)), null, null));
      return null;
    }
  }

  private async readAccount(client: AppServerClient): Promise<CodexAccount | null> {
    const response = await client.request(Resources.accountReadMethod, { refreshToken: false }, this.timings.requestTimeout);
    return CodexAccount.fromJson(response, Resources.resultPath);
  }

  private interrupt(client: AppServerClient, turn: CodexTurn): void {
    if (Object.isNull(turn.turnId))
      return;

    void client.request(Resources.turnInterruptMethod, { threadId: turn.threadId, turnId: turn.turnId }, this.timings.interruptTimeout).catch(() => undefined);
  }

  private static createExitHandler(turn: CodexTurn): IExitHandler {
    return { handleExit: () => turn.fail(Resources.appServerExitedDuringTurn) };
  }

  private static fail(error: string, harnessVersion: string | null, identity: ProviderAccountIdentity | null): TurnResult {
    return new TurnResult(TurnOutcome.Failed, null, new ObservedSettings(Resources.codexProviderId, null, null, harnessVersion, identity), error);
  }
}
