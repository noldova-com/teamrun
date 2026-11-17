/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter, once } from "node:events";
import { PassThrough, type Readable, type Writable } from "node:stream";

import "@noldova/context.core";

import { Resources } from "../../resources.js";

export class StartedProcess extends EventEmitter {
  private stopper: (() => Promise<void>) | null = null;
  private pendingStop: PromiseWithResolvers<void> | null = null;
  private processId: number | undefined = undefined;
  private code: number | null = null;
  private signal: NodeJS.Signals | null = null;
  private wasKilled: boolean = false;
  private ended: boolean = false;

  public readonly stdin: PassThrough = new PassThrough();
  public readonly stdout: PassThrough = new PassThrough();
  public readonly stderr: PassThrough = new PassThrough();

  public constructor() {
    super();
    this.stdin.on(Resources.errorEvent, () => undefined);
  }

  public get pid(): number | undefined {
    return this.processId;
  }

  public get exitCode(): number | null {
    return this.code;
  }

  public get signalCode(): NodeJS.Signals | null {
    return this.signal;
  }

  public get killed(): boolean {
    return this.wasKilled;
  }

  public get hasExited(): boolean {
    return this.ended;
  }

  public attach(processId: number, input: Writable, output: Readable, errors: Readable, stop: () => Promise<void>): void {
    this.processId = processId;
    this.stopper = stop;
    input.on(Resources.errorEvent, (error: Error) => this.stdin.destroy(error));
    this.stdin.pipe(input);
    output.pipe(this.stdout);
    errors.pipe(this.stderr);
    this.emit(Resources.spawnEvent);
    const pending = this.pendingStop;
    this.pendingStop = null;
    if (!Object.isNull(pending))
      this.stopAsync().then(pending.resolve, pending.reject);
  }

  public fail(error: Error): void {
    const pending = this.pendingStop;
    this.pendingStop = null;
    pending?.resolve();
    this.emit(Resources.errorEvent, error);
  }

  public end(code: number | null, signal: NodeJS.Signals | null): void {
    this.ended = true;
    this.code = code;
    this.signal = signal;
    this.stdin.destroy();
    if (Object.isNull(this.stopper)) {
      this.stdout.end();
      this.stderr.end();
    }
    this.emit(Resources.exitEvent, code, signal);
    void Promise.allSettled([this.stdout, this.stderr].map(t => StartedProcess.drainAsync(t)))
      .then(() => this.emit(Resources.closeEvent, code, signal));
  }

  public kill(_signal?: NodeJS.Signals): boolean {
    this.wasKilled = true;
    this.stopAsync().catch(() => undefined);
    return true;
  }

  public stopAsync(): Promise<void> {
    if (this.hasExited)
      return Promise.resolve();
    if (!Object.isNull(this.stopper))
      return this.stopper();

    this.pendingStop ??= Promise.withResolvers<void>();
    return this.pendingStop.promise;
  }

  private static async drainAsync(stream: PassThrough): Promise<void> {
    if (stream.readableEnded || stream.readableFlowing !== true)
      return;

    await once(stream, Resources.endEvent);
  }
}
