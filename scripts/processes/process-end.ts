/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class ProcessEnd {
  private static readonly HEX_FROM: number = 0x10000;

  public readonly exitCode: number | null;
  public readonly signal: NodeJS.Signals | null;

  public constructor(exitCode: number | null, signal: NodeJS.Signals | null) {
    this.exitCode = exitCode;
    this.signal = signal;
  }

  public get isSuccessful(): boolean {
    return this.exitCode === 0;
  }

  public describe(): string {
    if (!Object.isNull(this.signal))
      return `on signal ${this.signal}`;
    if (Object.isNull(this.exitCode))
      return "with no exit code or signal";
    return this.exitCode >= ProcessEnd.HEX_FROM
      ? `with exit code ${this.exitCode} (0x${this.exitCode.toString(16).toUpperCase()})`
      : `with exit code ${this.exitCode}`;
  }
}
