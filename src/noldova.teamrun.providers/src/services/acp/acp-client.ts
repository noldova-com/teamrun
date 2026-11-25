/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";
import { type ITimer, NodeTimer, TimeoutException } from "@noldova/teamrun.core";

import { MessageFraming } from "../../enums/message-framing.js";
import { AcpConnectionException } from "../../exceptions/acp-connection.exception.js";
import { AcpRequestException } from "../../exceptions/acp-request.exception.js";
import type { IAcpClientListener } from "../../interfaces/i-acp-client-listener.js";
import type { IAcpToolGate } from "../../interfaces/i-acp-tool-gate.js";
import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import type { IProcessTree } from "../../interfaces/i-process-tree.js";
import { PendingRequest } from "../../models/pending-request.js";
import type { ProcessCommand } from "../../models/process-command.js";
import type { ProviderTimings } from "../../models/provider-timings.js";
import { Resources } from "../../resources.js";
import type { StartedProcess } from "../process/started-process.js";

export class AcpClient {
  private readonly command: ProcessCommand;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly starter: IProcessStarter;
  private readonly timings: ProviderTimings;
  private readonly timer: ITimer;
  private readonly framing: MessageFraming;
  private readonly tree: IProcessTree | null;
  private readonly pending: Map<number, PendingRequest> = new Map();
  private readonly reverseRequests: Set<string | number> = new Set();
  private readonly closed = Promise.withResolvers<void>();
  private child: StartedProcess | null = null;
  private listener: IAcpClientListener | null = null;
  private readonly gate: IAcpToolGate | null;
  private nextId: number = 0;
  private buffered: string = String.empty;
  private stopping: boolean = false;
  private exited: number | null = null;
  private stopped: Promise<void> | null = null;
  private left: Promise<void> | null = null;
  private startsTools: boolean = false;
  private ended: boolean = false;
  private launched: number | null = null;
  private handled: Promise<void> = Promise.resolve();
  private broken: boolean = false;

  public readonly directory: string;

  public constructor(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string,
    starter: IProcessStarter, timings: ProviderTimings, timer: ITimer = new NodeTimer(), framing: MessageFraming = MessageFraming.Lines,
    tree: IProcessTree | null = null, gate: IAcpToolGate | null = null) {
    this.command = command;
    this.environment = environment;
    this.directory = directory;
    this.starter = starter;
    this.timings = timings;
    this.timer = timer;
    this.framing = framing;
    this.tree = tree;
    this.gate = gate;
  }

  public start(): void {
    if (!Object.isNull(this.child))
      throw new AcpConnectionException(Resources.acpAlreadyStarted);
    this.launched = Date.now();
    const child = this.starter.start(this.command, this.environment, this.directory);
    this.child = child;
    child.stdout.setEncoding(Resources.utf8Encoding);
    child.stdout.on(Resources.dataEvent, (text: string) => this.receive(text));
    child.stderr.resume();
    child.stdin.on(Resources.errorEvent, () => this.failPending(new AcpConnectionException(Resources.acpDisconnected)));
    child.once(Resources.errorEvent, (error: Error) => this.failPending(error));
    child.once(Resources.exitEvent, () => { this.exited ??= Date.now(); });
    child.once(Resources.closeEvent, () => {
      this.exited ??= Date.now();
      this.failPending(new AcpConnectionException(Resources.acpDisconnected));
      this.closed.resolve();
      if (this.stopping)
        return;
      const listener = this.listener;
      void this.endLeftovers().then(() => this.enqueue(() => listener?.onExitAsync()));
    });
  }

  public get processId(): number | null {
    return this.child?.pid ?? null;
  }

  public get isConnected(): boolean {
    return !this.stopping && Object.isNull(this.exited) && !Object.isNull(this.child) && !this.child.stdin.destroyed;
  }

  public get isStopping(): boolean {
    return this.stopping;
  }

  public get processClosed(): Promise<void> {
    return this.closed.promise;
  }

  public setListener(listener: IAcpClientListener | null): void {
    this.listener = listener;
  }

  public whenHandledAsync(): Promise<void> {
    return this.handled;
  }

  public request(method: string, params: JsonObject, timeout: number | null = this.timings.requestTimeout): Promise<JsonValue> {
    if (!this.isConnected)
      return Promise.reject(new AcpConnectionException(Resources.acpDisconnected));
    if (this.pending.size >= Resources.acpMaximumPending)
      return Promise.reject(new AcpConnectionException(Resources.acpTooManyRequests));
    const id = ++this.nextId;
    const resolvers = Promise.withResolvers<JsonValue>();
    const elapsed = new AbortController();
    this.pending.set(id, new PendingRequest(method, resolvers, elapsed));
    if (!Object.isNull(timeout))
      void this.timer.delayAsync(timeout, elapsed.signal).then(() => {
        this.pending.get(id)?.fail(new TimeoutException(Resources.formatAcpTimeout(method)));
        this.pending.delete(id);
      }, () => undefined);
    this.startsTools ||= method === Resources.acpSessionPrompt || AcpClient.opensServers(method, params);
    this.write({ jsonrpc: Resources.acpJsonRpcVersion, id, method, params });
    return resolvers.promise;
  }

  public notify(method: string, params: JsonObject): void {
    this.write({ jsonrpc: Resources.acpJsonRpcVersion, method, params });
  }

  public stop(): Promise<void> {
    if (this.ended)
      return Promise.resolve();
    if (!Object.isNull(this.stopped))
      return this.stopped.then(() => undefined, () => this.stop());
    this.stopped = this.end().finally(() => { this.stopped = null; });
    return this.stopped;
  }

  private async end(): Promise<void> {
    this.stopping = true;
    this.listener = null;
    const child = this.child;
    if (Object.isNull(child))
      return;
    this.failPending(new AcpConnectionException(Resources.acpDisconnected));
    const processId = child.pid ?? null;
    if (!Object.isNull(this.tree) && !Object.isNull(processId) && Object.isNull(this.exited) && this.startsTools)
      await this.sweep(this.tree.endDescendants(processId));
    child.stdin.end();
    if (!await this.waitForClose(this.timings.stopGrace)) {
      await child.stopAsync();
      if (!await this.waitForClose(this.timings.killWait))
        throw new AcpConnectionException(Resources.acpDidNotStop);
    }
    await this.endLeftovers();
    this.ended = true;
  }

  private endLeftovers(): Promise<void> {
    const processId = this.processId;
    if (Object.isNull(this.tree) || Object.isNull(processId) || Object.isNull(this.launched) || Object.isNull(this.exited) || !this.startsTools)
      return Promise.resolve();
    this.left ??= this.sweep(this.tree.endLeftovers(processId, this.launched, this.exited));
    return this.left;
  }

  private async sweep(swept: Promise<void>): Promise<void> {
    const elapsed = new AbortController();
    try {
      await Promise.race([swept.catch(() => undefined), this.timer.delayAsync(this.timings.killWait, elapsed.signal)]);
    }
    finally {
      elapsed.abort();
    }
  }

  private receive(text: string): void {
    this.buffered += text;
    if (this.buffered.length > Resources.acpMaximumBufferedCharacters) {
      this.abandon(new AcpConnectionException(Resources.acpFrameTooLarge));
      return;
    }
    if (this.framing === MessageFraming.ContentLength) {
      this.receiveFrames();
      return;
    }
    if (!text.includes(Resources.lineSeparator))
      return;
    let boundary: number;
    while ((boundary = this.buffered.indexOf(Resources.lineSeparator)) >= 0) {
      const line = this.buffered.slice(0, boundary).trim();
      this.buffered = this.buffered.slice(boundary + 1);
      if (line.length !== 0 && !this.dispatch(line))
        return;
    }
  }

  private receiveFrames(): void {
    let end: number;
    while ((end = this.buffered.indexOf(Resources.frameHeaderSeparator)) >= 0) {
      const header = this.buffered.slice(0, end).split(Resources.frameHeaderLineSeparator).map(t => Resources.contentLengthHeader.exec(t))
        .find(t => !Object.isNull(t));
      if (Object.isUndefined(header)) {
        this.abandon(new AcpConnectionException(Resources.acpInvalidFrame));
        return;
      }
      const length = Number(header[1]);
      const body = Buffer.from(this.buffered.slice(end + Resources.frameHeaderSeparator.length), Resources.utf8Encoding);
      if (body.length < length)
        return;
      this.buffered = body.subarray(length).toString(Resources.utf8Encoding);
      if (!this.dispatch(body.subarray(0, length).toString(Resources.utf8Encoding)))
        return;
    }
  }

  private dispatch(text: string): boolean {
    try {
      this.handle(JsonReader.parse(text));
      return true;
    }
    catch (error) {
      this.abandon(AcpClient.errorOf(error));
      return false;
    }
  }

  private abandon(error: Error): void {
    this.failPending(error);
    void this.stop().catch(() => undefined);
  }

  private handle(message: JsonReader): void {
    const value = message.toJson();
    const id = value[Resources.idField];
    const method = message.readOptionalString(Resources.methodField);
    const listener = this.listener;
    if (!Object.isUndefined(method)) {
      const params = message.hasField(Resources.paramsField) ? message.readObject(Resources.paramsField) : JsonReader.fromValue({});
      if (Object.isString(id) || Object.isNumber(id)) {
        const refusal = Object.isNull(this.gate) || !this.gate.methods.includes(method) ? null : this.gate.answer(Resources.acpGatedRequestRefused);
        if (this.reverseRequests.size >= Resources.acpMaximumPending || this.reverseRequests.has(id)) {
          this.write(Object.isNull(refusal) ? { jsonrpc: Resources.acpJsonRpcVersion, id, error: { code: Resources.acpUnsupportedCode, message: Resources.acpTooManyRequests } }
            : { jsonrpc: Resources.acpJsonRpcVersion, id, result: refusal });
          return;
        }
        this.reverseRequests.add(id);
        const response = Promise.resolve().then(() => this.handled).then(() => {
          if (Object.isNull(listener))
            throw new AcpConnectionException(Resources.acpUnsupportedRequest);
          return listener.onRequest(String(id), method, params);
        });
        void response.then(result => this.write({ jsonrpc: Resources.acpJsonRpcVersion, id, result }),
          (error: unknown) => this.write(!Object.isNull(refusal) ? { jsonrpc: Resources.acpJsonRpcVersion, id, result: refusal }
            : { jsonrpc: Resources.acpJsonRpcVersion, id, error: error instanceof AcpRequestException && !Object.isNull(error.code)
              ? { code: error.code, message: error.message } : { code: Resources.acpUnsupportedCode, message: Resources.acpUnsupportedRequest } }))
          .finally(() => this.reverseRequests.delete(id));
      }
      else {
        this.enqueue(() => listener?.onNotificationAsync(method, params));
      }
      return;
    }
    if (!Object.isNumber(id))
      return;
    const pending = this.pending.get(id);
    if (Object.isUndefined(pending))
      return;
    const result = message.toJson()[Resources.resultField];
    const read = Object.isObject(result) && !Array.isArray(result) ? message.readObject(Resources.resultField) : null;
    this.pending.delete(id);
    pending.stopTimer();
    this.enqueue(async () => {
      await listener?.onResponseAsync(pending.method, read);
      const failure = message.hasField(Resources.errorField) ? AcpClient.failureOf(message.readObject(Resources.errorField)) : null;
      if (Object.isNull(failure))
        pending.complete(value[Resources.resultField] ?? null);
      else
        pending.fail(failure);
    }, error => pending.fail(error));
  }

  private enqueue(work: () => Promise<void> | undefined, unfinished: (error: Error) => void = () => undefined): void {
    this.handled = this.handled.then(() => {
      if (!this.broken)
        return work();
      unfinished(new AcpConnectionException(Resources.acpDisconnected));
      return undefined;
    }).catch((error: unknown) => {
      const failure = AcpClient.errorOf(error);
      unfinished(failure);
      this.broken = true;
      this.abandon(failure);
    });
  }

  private static errorOf(error: unknown): Error {
    return error instanceof Error ? error : new AcpConnectionException(Resources.acpInvalidFrame);
  }

  private static failureOf(error: JsonReader): AcpRequestException {
    const code = error.toJson()[Resources.codeField];
    return new AcpRequestException(error.readString(Resources.messageField), Object.isNumber(code) ? code : null, error.toJson()[Resources.dataField] ?? null);
  }

  private write(message: JsonObject): void {
    if (!this.stopping && !Object.isNull(this.child) && !this.child.stdin.destroyed)
      this.child.stdin.write(this.frame(JSON.stringify(message)));
  }

  private frame(text: string): string {
    return this.framing === MessageFraming.ContentLength
      ? `${Resources.contentLengthName}: ${Buffer.byteLength(text, Resources.utf8Encoding)}${Resources.frameHeaderSeparator}${text}`
      : `${text}${Resources.lineSeparator}`;
  }

  private failPending(error: Error): void {
    for (const pending of this.pending.values())
      pending.fail(error);
    this.pending.clear();
  }

  private async waitForClose(milliseconds: number): Promise<boolean> {
    const elapsed = new AbortController();
    try {
      return await Promise.race([this.closed.promise.then(() => true), this.timer.delayAsync(milliseconds, elapsed.signal).then(() => false)]);
    }
    finally {
      elapsed.abort();
    }
  }

  private static opensServers(method: string, params: JsonObject): boolean {
    const servers = params[Resources.acpMcpServersField];
    return Resources.acpSessionOpenMethods.includes(method) && Array.isArray(servers) && servers.length > 0;
  }
}
