/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { Readable, Writable } from "node:stream";

import "@noldova/teamrun-foundation-core";

import type { ProcessExit } from "./process-exit.js";

export class OwnedProcess {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly stop: (process: OwnedProcess) => Promise<void>;
  private stopping: Promise<ProcessExit> | null = null;

  public readonly processId: number;
  public readonly program: string;
  public readonly started: Date;
  public readonly exited: Promise<ProcessExit>;

  public constructor(child: ChildProcessWithoutNullStreams, program: string, started: Date, exited: Promise<ProcessExit>, stop: (process: OwnedProcess) => Promise<void>) {
    this.child = child;
    this.stop = stop;
    this.processId = Number(child.pid);
    this.program = program;
    this.started = started;
    this.exited = exited;
  }

  public get input(): Writable {
    return this.child.stdin;
  }

  public get output(): Readable {
    return this.child.stdout;
  }

  public get errors(): Readable {
    return this.child.stderr;
  }

  public get hasExited(): boolean {
    return !Object.isNull(this.child.exitCode) || !Object.isNull(this.child.signalCode);
  }

  public stopAsync(): Promise<ProcessExit> {
    this.stopping ??= this.stop(this).then(() => this.exited);
    return this.stopping;
  }
}
