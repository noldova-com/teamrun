/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import { type ILog, type ITurnListener, NodeTimer, TurnDetail } from "@noldova/teamrun.core";
import { DetailKind } from "@noldova/teamrun.protocol";

import { AppServerException } from "../../exceptions/app-server.exception.js";
import { AppServerUnavailableException } from "../../exceptions/app-server-unavailable.exception.js";
import type { IExitHandler } from "../../interfaces/i-exit-handler.js";
import type { INotificationHandler } from "../../interfaces/i-notification-handler.js";
import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import type { IServerRequestHandler } from "../../interfaces/i-server-request-handler.js";
import type { AppServerClientInfo } from "../../models/app-server-client-info.js";
import { AppServerInitialization } from "../../models/app-server-initialization.js";
import { HandlerSubscription } from "../../models/handler-subscription.js";
import { JsonRpcError } from "../../models/json-rpc-error.js";
import { PendingRequest } from "../../models/pending-request.js";
import type { ProcessCommand } from "../../models/process-command.js";
import { ProcessExit } from "../../models/process-exit.js";
import type { ProviderTimings } from "../../models/provider-timings.js";
import { TailBuffer } from "../../models/tail-buffer.js";
import { Resources } from "../../resources.js";
import { FailureDescriber } from "../failure-describer.js";
import type { StartedProcess } from "../process/started-process.js";

export class AppServerClient {
  private readonly command: ProcessCommand;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly clientInfo: AppServerClientInfo;
  private readonly starter: IProcessStarter;
  private readonly timings: ProviderTimings;
  private readonly log: ILog | null;
  private readonly pending: Map<number, PendingRequest> = new Map();
  private readonly notificationHandlers: Map<INotificationHandler, ITurnListener | null> = new Map();
  private readonly notedFailures: WeakMap<ITurnListener, Set<string>> = new WeakMap();
  private readonly exitHandlers: Set<IExitHandler> = new Set();
  private readonly serverRequests: Map<string, AbortController> = new Map();
  private readonly stderrTail: TailBuffer = new TailBuffer(Resources.maximumStderrChunks);
  private readonly exit: PromiseWithResolvers<ProcessExit> = Promise.withResolvers<ProcessExit>();
  private child: StartedProcess | null = null;
  private serverRequestHandler: IServerRequestHandler | null = null;
  private buffer: string = String.empty;
  private nextId: number = 1;
  private exited: boolean = false;
  private droppedLines: number = 0;
  private handlerFailures: number = 0;
  private initializationResult: AppServerInitialization | null = null;
  private queue: Promise<void> = Promise.resolve();

  public constructor(
    command: ProcessCommand,
    environment: NodeJS.ProcessEnv,
    clientInfo: AppServerClientInfo,
    starter: IProcessStarter,
    timings: ProviderTimings,
    log: ILog | null = null) {
    this.command = command;
    this.environment = environment;
    this.clientInfo = clientInfo;
    this.starter = starter;
    this.timings = timings;
    this.log = log;
  }

  public get isAlive(): boolean {
    return !Object.isNull(this.child) && !this.exited;
  }

  public get initialization(): AppServerInitialization | null {
    return this.initializationResult;
  }

  public get processId(): number | null {
    return this.exited ? null : this.child?.pid ?? null;
  }

  public get version(): string | null {
    return Object.isNull(this.initializationResult) ? null : this.initializationResult.version;
  }

  public get droppedLineCount(): number {
    return this.droppedLines;
  }

  public get handlerFailureCount(): number {
    return this.handlerFailures;
  }

  public get stderr(): string {
    return this.stderrTail.toString();
  }

  public waitForExit(): Promise<ProcessExit> {
    return this.exit.promise;
  }

  public settledAsync(): Promise<void> {
    return this.queue;
  }

  public runInOrderAsync(work: () => Promise<void>): Promise<void> {
    const result = this.queue.then(work);
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  public async start(): Promise<AppServerInitialization> {
    if (!Object.isNull(this.child))
      throw new AppServerUnavailableException(Resources.appServerAlreadyStarted);

    const child = this.starter.start(this.command, this.environment, null);
    this.child = child;
    child.on(Resources.closeEvent, (code: number | null, signal: NodeJS.Signals | null) => {
      this.handleExit(new ProcessExit(code, signal));
    });
    child.on(Resources.errorEvent, (error: Error) => this.handleSpawnError(error));
    child.stdout.setEncoding(Resources.utf8Encoding);
    child.stdout.on(Resources.dataEvent, (chunk: string) => this.receive(chunk));
    child.stderr.setEncoding(Resources.utf8Encoding);
    child.stderr.on(Resources.dataEvent, (chunk: string) => this.stderrTail.push(chunk));

    const params = { clientInfo: this.clientInfo.toJson(), capabilities: { experimentalApi: true } };
    const initialization = AppServerInitialization.fromJson(await this.request(Resources.initializeMethod, params, this.timings.initializeTimeout));
    this.notify(Resources.initializedMethod, {});
    this.initializationResult = initialization;

    return initialization;
  }

  public subscribe(handler: INotificationHandler, listener: ITurnListener | null = null): HandlerSubscription<INotificationHandler> {
    this.notificationHandlers.set(handler, listener);
    return new HandlerSubscription(this.notificationHandlers, handler);
  }

  public subscribeExit(handler: IExitHandler): HandlerSubscription<IExitHandler> {
    this.exitHandlers.add(handler);
    return new HandlerSubscription(this.exitHandlers, handler);
  }

  public setServerRequestHandler(handler: IServerRequestHandler | null): void {
    this.serverRequestHandler = handler;
  }

  public request(method: string, params: JsonValue, timeoutMilliseconds: number): Promise<JsonValue> {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(timeoutMilliseconds, Resources.timeoutParameterName);
    if (!this.isAlive)
      return Promise.reject(new AppServerUnavailableException(Resources.formatAppServerNotRunning(method)));

    const id = this.nextId++;
    const resolvers = Promise.withResolvers<JsonValue>();
    const elapsed = new AbortController();
    this.pending.set(id, new PendingRequest(method, resolvers, elapsed));
    void new NodeTimer().delayAsync(timeoutMilliseconds, elapsed.signal).then(() => {
      this.pending.delete(id);
      resolvers.reject(new AppServerUnavailableException(Resources.formatAppServerTimedOut(method)));
    }, () => undefined);
    this.write({ id, method, params });

    return resolvers.promise;
  }

  public notify(method: string, params: JsonValue): void {
    if (this.isAlive)
      this.write({ method, params });
  }

  public async stop(): Promise<void> {
    const child = this.child;
    if (Object.isNull(child) || this.exited)
      return;

    child.stdin.end();
    const grace = Promise.withResolvers<boolean>();
    const timer = setTimeout(() => grace.resolve(false), this.timings.stopGrace);
    const exited = await Promise.race([this.exit.promise.then(() => true), grace.promise]);
    clearTimeout(timer);
    if (!exited)
      await child.stopAsync();
  }

  private write(message: JsonValue): void {
    if (!Object.isNull(this.child) && this.child.stdin.writable)
      this.child.stdin.write(`${JSON.stringify(message)}${Resources.lineSeparator}`);
  }

  private receive(chunk: string): void {
    this.buffer += chunk;
    if (!chunk.includes(Resources.lineSeparator))
      return;
    let index = this.buffer.indexOf(Resources.lineSeparator);
    while (index >= 0) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (!String.isNullOrWhitespace(line))
        this.receiveLine(line);
      index = this.buffer.indexOf(Resources.lineSeparator);
    }
  }

  private receiveLine(line: string): void {
    let reader: JsonReader;
    try {
      reader = JsonReader.parse(line);
    }
    catch {
      this.droppedLines += 1;
      return;
    }
    this.dispatch(reader);
  }

  private dispatch(reader: JsonReader): void {
    const id = reader.hasField(Resources.idField) ? reader.readValue(Resources.idField) : null;
    const method = reader.hasField(Resources.methodField) ? reader.readValue(Resources.methodField) : null;
    if (Object.isString(method)) {
      const params = AppServerClient.readParams(reader);
      if (Object.isNull(id))
        this.enqueue(() => this.dispatchNotificationAsync(method, params));
      else
        this.enqueue(() => {
          this.dispatchServerRequest(id, method, params);
          return Promise.resolve();
        });
      return;
    }
    if (Object.isNumber(id))
      this.dispatchResponse(id, reader);
  }

  private enqueue(work: () => Promise<void>): void {
    this.queue = this.queue.then(work).catch((error: unknown) => this.countFailure(error));
  }

  private countFailure(error: unknown): void {
    this.handlerFailures += 1;
    this.log?.write(FailureDescriber.describe(error));
  }

  private async dispatchNotificationAsync(method: string, params: JsonReader): Promise<void> {
    if (method === Resources.serverRequestResolvedNotification)
      this.withdrawServerRequest(params);
    for (const [handler, listener] of this.notificationHandlers)
      try {
        await handler.handleNotificationAsync(method, params);
      }
      catch (error) {
        this.handlerFailures += 1;
        await this.reportHandlerFailureAsync(listener, Resources.formatCodexNotificationFailed(method, FailureDescriber.describe(error)));
      }
  }

  private async reportHandlerFailureAsync(listener: ITurnListener | null, text: string): Promise<void> {
    if (Object.isNull(listener)) {
      this.log?.write(text);
      return;
    }
    const noted = this.notedFailures.get(listener) ?? new Set<string>();
    if (noted.has(text))
      return;
    try {
      await listener.onDetailAsync(new TurnDetail(DetailKind.Note, text, null, null));
      noted.add(text);
      this.notedFailures.set(listener, noted);
    }
    catch {
      this.log?.write(text);
    }
  }

  private dispatchServerRequest(id: JsonValue, method: string, params: JsonReader): void {
    const handler = this.serverRequestHandler;
    if (Object.isNull(handler)) {
      this.write({ id, error: new JsonRpcError(Resources.unsupportedServerRequestCode, Resources.appServerNoRequestHandler, null).toJson() });
      return;
    }

    const key = JSON.stringify(id);
    const controller = new AbortController();
    this.serverRequests.set(key, controller);
    Promise.try(() => handler.handleServerRequest(method, params, controller.signal))
      .then(result => this.answerServerRequest(key, controller, { id, result }))
      .catch((error: unknown) => this.answerServerRequest(key, controller, {
        id,
        error: new JsonRpcError(Resources.serverRequestFailedCode, FailureDescriber.describe(error), null).toJson()
      }));
  }

  private answerServerRequest(key: string, controller: AbortController, answer: JsonValue): void {
    if (controller.signal.aborted)
      return;

    this.serverRequests.delete(key);
    this.write(answer);
  }

  private withdrawServerRequest(params: JsonReader): void {
    const requestId = params.hasField(Resources.requestIdField) ? params.readValue(Resources.requestIdField) : null;
    const key = JSON.stringify(requestId);
    const controller = this.serverRequests.get(key);
    if (Object.isUndefined(controller))
      return;

    this.serverRequests.delete(key);
    controller.abort();
  }

  private dispatchResponse(id: number, reader: JsonReader): void {
    const pending = this.pending.get(id);
    if (Object.isUndefined(pending))
      return;

    this.pending.delete(id);
    const error = reader.hasField(Resources.errorField) ? reader.readValue(Resources.errorField) : null;
    if (!Object.isNull(error)) {
      pending.fail(new AppServerException(pending.method, JsonRpcError.fromJson(error, Resources.errorPath)));
      return;
    }

    pending.complete(reader.hasField(Resources.resultField) ? reader.readValue(Resources.resultField) : null);
  }

  private handleExit(exit: ProcessExit): void {
    this.exited = true;
    this.failPending(new AppServerUnavailableException(Resources.formatAppServerExited(exit.code, exit.signal, this.stderrTail.toString())));
    this.exit.resolve(exit);
    this.enqueue(async () => {
      for (const handler of this.exitHandlers)
        try {
          await handler.handleExitAsync(exit);
        }
        catch (error) {
          this.countFailure(error);
        }
    });
  }

  private handleSpawnError(error: Error): void {
    this.exited = true;
    this.failPending(new AppServerUnavailableException(error.message));
  }

  private failPending(error: Error): void {
    for (const pending of this.pending.values())
      pending.fail(error);
    this.pending.clear();
  }

  private static readParams(reader: JsonReader): JsonReader {
    const params = reader.hasField(Resources.paramsField) ? reader.readValue(Resources.paramsField) : null;
    return JsonReader.fromValue(Object.isNull(params) ? {} : params, Resources.paramsPath);
  }
}
