/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ChildProcess } from "node:child_process";
import { setTimeout } from "node:timers/promises";

import ProcessException from "./process.exception.ts";

export default class StartedProcess {
  private readonly child: ChildProcess;
  private readonly exited: Promise<void>;

  public constructor(child: ChildProcess) {
    this.child = child;
    this.exited = new Promise<void>(resolve => child.once("exit", () => resolve()));
  }

  public get id(): number {
    if (this.child.pid === undefined)
      throw new ProcessException("The process has no process ID, because it never started.");
    return this.child.pid;
  }

  public get hasExited(): boolean {
    return this.child.exitCode !== null || this.child.signalCode !== null;
  }

  public get exitCode(): number | null {
    return this.child.exitCode;
  }

  public async waitAsync(timeout: number): Promise<boolean> {
    const deadline = new AbortController();
    await Promise.race([this.exited, setTimeout(timeout, undefined, { signal: deadline.signal }).catch(() => undefined)]);
    deadline.abort();
    return this.hasExited;
  }

  public signal(name: NodeJS.Signals): void {
    this.child.kill(name);
  }
}
