/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

export class CommandResult {
  public readonly exitCode: number | null;
  public readonly signal: string | null;
  public readonly stdout: string;
  public readonly stderr: string;
  public readonly timedOut: boolean;

  public constructor(exitCode: number | null, signal: string | null, stdout: string, stderr: string, timedOut: boolean) {
    this.exitCode = exitCode;
    this.signal = signal;
    this.stdout = stdout;
    this.stderr = stderr;
    this.timedOut = timedOut;
  }

  public get succeeded(): boolean {
    return this.exitCode === 0 && !this.timedOut;
  }

  public get output(): string {
    return (String.isNullOrWhitespace(this.stdout) ? this.stderr : this.stdout).trim();
  }
}
