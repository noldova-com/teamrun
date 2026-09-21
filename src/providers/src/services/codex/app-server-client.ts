/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcessByStdio, spawn } from "node:child_process";
import type { Readable, Writable } from "node:stream";

import "@noldova/teamrun-foundation-core";
import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonValue } from "@noldova/teamrun-foundation-json";

import { AppServerException } from "../../exceptions/app-server.exception.js";
import { AppServerUnavailableException } from "../../exceptions/app-server-unavailable.exception.js";
import type { IExitHandler } from "../../interfaces/i-exit-handler.js";
import type { INotificationHandler } from "../../interfaces/i-notification-handler.js";
import type { IProcessTracker } from "../../interfaces/i-process-tracker.js";
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
import type { ProcessTerminator } from "../process/process-terminator.js";

export class AppServerClient {
  private readonly command: ProcessCommand;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly clientInfo: AppServerClientInfo;
  private readonly terminator: ProcessTerminator;
  private readonly timings: ProviderTimings;
  private readonly pending: Map<number, PendingRequest> = new Map();
  private readonly notificationHandlers: Set<INotificationHandler> = new Set();
  private readonly exitHandlers: Set<IExitHandler> = new Set();
  private readonly tracker: IProcessTracker;
  private readonly stderrTail: TailBuffer = new TailBuffer(Resources.maximumStderrChunks);
  private readonly exit: PromiseWithResolvers<ProcessExit> = Promise.withResolvers<ProcessExit>();
  private child: ChildProcessByStdio<Writable, Readable, Readable> | null = null;
  private serverRequestHandler: IServerRequestHandler | null = null;
  private buffer: string = String.empty;
  private nextId: number = 1;
  private exited: boolean = false;
  private droppedLines: number = 0;
  private handlerFailures: number = 0;
  private initializationResult: AppServerInitialization | null = null;

  public constructor(
    command: ProcessCommand,
    environment: NodeJS.ProcessEnv,
    clientInfo: AppServerClientInfo,
    terminator: ProcessTerminator,
    timings: ProviderTimings,
    tracker: IProcessTracker) {
    this.command = command;
    this.tracker = tracker;
    this.environment = environment;
    this.clientInfo = clientInfo;
    this.terminator = terminator;
    this.timings = timings;
  }

  public get isAlive(): boolean {
    return !Object.isNull(this.child) && !this.exited;
  }

  public get initialization(): AppServerInitialization | null {
    return this.initializationResult;
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

  public async start(): Promise<AppServerInitialization> {
    if (!Object.isNull(this.child))
      throw new AppServerUnavailableException(Resources.appServerAlreadyStarted);

    const child = spawn(this.command.executable, this.command.arguments, { env: this.environment, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    this.child = child;
    const processId = child.pid ?? Resources.unknownProcessId;
    this.tracker.track(processId, this.command.executable);
    child.on(Resources.closeEvent, (code: number | null, signal: NodeJS.Signals | null) => {
      this.tracker.untrack(processId);
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

  public subscribe(handler: INotificationHandler): HandlerSubscription<INotificationHandler> {
    this.notificationHandlers.add(handler);
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
    const timer = setTimeout(() => {
      this.pending.delete(id);
      resolvers.reject(new AppServerUnavailableException(Resources.formatAppServerTimedOut(method)));
    }, timeoutMilliseconds);
    this.pending.set(id, new PendingRequest(method, resolvers, timer));
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
      await this.terminator.terminate(child);
  }

  private write(message: JsonValue): void {
    if (!Object.isNull(this.child) && this.child.stdin.writable)
      this.child.stdin.write(`${JSON.stringify(message)}${Resources.lineSeparator}`);
  }

  private receive(chunk: string): void {
    this.buffer += chunk;
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
      if (Object.isNull(id))
        this.dispatchNotification(method, AppServerClient.readParams(reader));
      else
        this.dispatchServerRequest(id, method, AppServerClient.readParams(reader));
      return;
    }
    if (Object.isNumber(id))
      this.dispatchResponse(id, reader);
  }

  private dispatchNotification(method: string, params: JsonReader): void {
    for (const handler of this.notificationHandlers)
      try {
        handler.handleNotification(method, params);
      }
      catch {
        this.handlerFailures += 1;
      }
  }

  private dispatchServerRequest(id: JsonValue, method: string, params: JsonReader): void {
    const handler = this.serverRequestHandler;
    if (Object.isNull(handler)) {
      this.write({ id, error: new JsonRpcError(Resources.unsupportedServerRequestCode, Resources.appServerNoRequestHandler, null).toJson() });
      return;
    }

    handler.handleServerRequest(method, params)
      .then(result => this.write({ id, result }))
      .catch((error: unknown) => this.write({
        id,
        error: new JsonRpcError(Resources.serverRequestFailedCode, FailureDescriber.describe(error), null).toJson()
      }));
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
    for (const handler of this.exitHandlers)
      handler.handleExit(exit);
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
