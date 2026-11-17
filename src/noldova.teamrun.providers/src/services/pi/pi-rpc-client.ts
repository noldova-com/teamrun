/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";

import { PiRpcException } from "../../exceptions/pi-rpc.exception.js";
import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import type { ProcessCommand } from "../../models/process-command.js";
import { ProcessExit } from "../../models/process-exit.js";
import { TailBuffer } from "../../models/tail-buffer.js";
import { Resources } from "../../resources.js";
import type { StartedProcess } from "../process/started-process.js";

export class PiRpcClient {
  private readonly command: ProcessCommand;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly directory: string | null;
  private readonly starter: IProcessStarter;
  private readonly stopGrace: number;
  private readonly pending: Map<string, { readonly type: string; readonly answer: PromiseWithResolvers<JsonReader>; readonly timer: NodeJS.Timeout }> = new Map();
  private readonly stderrTail: TailBuffer = new TailBuffer(Resources.maximumStderrChunks);
  private readonly exit: PromiseWithResolvers<ProcessExit> = Promise.withResolvers<ProcessExit>();
  private eventHandler: ((event: JsonReader) => Promise<void> | void) | null = null;
  private child: StartedProcess | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private nextId: number = 1;
  private handlerFailures: number = 0;
  private exited: boolean = false;

  public constructor(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string | null, starter: IProcessStarter, stopGrace: number) {
    this.command = command;
    this.environment = environment;
    this.directory = directory;
    this.starter = starter;
    this.stopGrace = stopGrace;
  }

  public get isAlive(): boolean {
    return !Object.isNull(this.child) && !this.exited;
  }

  public get stderr(): string {
    return this.stderrTail.toString();
  }

  public get handlerFailureCount(): number {
    return this.handlerFailures;
  }

  public waitForExit(): Promise<ProcessExit> {
    return this.exit.promise;
  }

  public start(onEvent: ((event: JsonReader) => Promise<void> | void) | null): void {
    if (!Object.isNull(this.child))
      throw new PiRpcException(Resources.piAlreadyStarted);

    this.eventHandler = onEvent;
    const child = this.starter.start(this.command, this.environment, this.directory);
    this.child = child;
    child.on(Resources.closeEvent, (code: number | null, signal: NodeJS.Signals | null) => this.handleExit(new ProcessExit(code, signal)));
    child.on(Resources.errorEvent, (error: Error) => this.fail(new PiRpcException(error.message)));
    child.stdout.on(Resources.dataEvent, (chunk: Buffer) => this.receive(chunk));
    child.stderr.setEncoding(Resources.utf8Encoding);
    child.stderr.on(Resources.dataEvent, (chunk: string) => this.stderrTail.push(chunk));
  }

  public listen(onEvent: ((event: JsonReader) => Promise<void> | void) | null): void {
    this.eventHandler = onEvent;
  }

  public request(type: string, fields: JsonObject, timeoutMilliseconds: number): Promise<JsonReader> {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(timeoutMilliseconds, Resources.timeoutParameterName);
    if (!this.isAlive)
      return Promise.reject(new PiRpcException(Resources.formatPiNotRunning(type)));

    const id = `${Resources.piRequestIdPrefix}${String(this.nextId++)}`;
    const answer = Promise.withResolvers<JsonReader>();
    const timer = setTimeout(() => {
      this.pending.delete(id);
      answer.reject(new PiRpcException(Resources.formatPiTimedOut(type)));
    }, timeoutMilliseconds);
    this.pending.set(id, { type, answer, timer });
    this.send({ ...fields, [Resources.idField]: id, [Resources.typeField]: type });
    return answer.promise;
  }

  public send(message: JsonObject): void {
    if (this.isAlive && this.child!.stdin.writable)
      this.child!.stdin.write(`${JSON.stringify(message)}${Resources.lineSeparator}`);
  }

  public async stop(): Promise<void> {
    const child = this.child;
    if (Object.isNull(child) || this.exited)
      return;

    child.stdin.end();
    const grace = Promise.withResolvers<boolean>();
    const timer = setTimeout(() => grace.resolve(false), this.stopGrace);
    const exited = await Promise.race([this.exit.promise.then(() => true), grace.promise]);
    clearTimeout(timer);
    if (!exited)
      await child.stopAsync();
  }

  private receive(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    let index = this.buffer.indexOf(Resources.lineFeedByte);
    while (index >= 0) {
      const line = this.buffer.subarray(0, index).toString(Resources.utf8Encoding).replace(Resources.trailingCarriageReturnPattern, String.empty);
      this.buffer = this.buffer.subarray(index + 1);
      if (!String.isNullOrWhitespace(line))
        this.receiveLine(line);
      index = this.buffer.indexOf(Resources.lineFeedByte);
    }
  }

  private receiveLine(line: string): void {
    let reader: JsonReader;
    try {
      reader = JsonReader.parse(line);
    }
    catch {
      return;
    }
    const field = (name: string): JsonValue => reader.hasField(name) ? reader.readValue(name) : null;
    const id = field(Resources.idField);
    const pending = Object.isString(id) ? this.pending.get(id) : undefined;
    if (field(Resources.typeField) !== Resources.piResponseType || Object.isUndefined(pending)) {
      this.handleEvent(reader);
      return;
    }
    this.pending.delete(id as string);
    clearTimeout(pending.timer);
    const data = field(Resources.dataField);
    const error = field(Resources.errorField);
    if (field(Resources.successField) === true)
      pending.answer.resolve(JsonReader.fromValue(Object.isObject(data) && !Array.isArray(data) ? data : {}, Resources.dataField));
    else
      pending.answer.reject(new PiRpcException(Resources.formatPiRefused(pending.type, Object.isString(error) ? error : null)));
  }

  private handleEvent(event: JsonReader): void {
    try {
      if (Object.isNull(this.eventHandler))
        this.cancelDialog(event);
      else
        this.countFailure(this.eventHandler(event));
    }
    catch {
      this.handlerFailures += 1;
    }
  }

  private countFailure(handled: Promise<void> | void): void {
    if (handled instanceof Promise)
      void handled.catch(() => {
        this.handlerFailures += 1;
      });
  }

  private cancelDialog(event: JsonReader): void {
    if (event.hasField(Resources.methodField) && Resources.piDialogMethods.includes(String(event.readValue(Resources.methodField))))
      this.send({ type: Resources.piExtensionResponseType, id: event.readValue(Resources.idField), cancelled: true });
  }

  private handleExit(exit: ProcessExit): void {
    this.fail(new PiRpcException(Resources.formatPiExited(exit.code, exit.signal, this.stderrTail.toString())));
    this.exit.resolve(exit);
  }

  private fail(error: PiRpcException): void {
    this.exited = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.answer.reject(error);
    }
    this.pending.clear();
  }
}
