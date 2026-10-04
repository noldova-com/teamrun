/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ProcessKillFixture implements Disposable {
  private static readonly MISSING_CODE: string = "ESRCH";

  private readonly kill: typeof process.kill = process.kill;

  public readonly signals: string[] = [];

  public constructor(isRunning: (processId: number, signal: string | number) => boolean) {
    process.kill = (processId: number, signal: string | number = "SIGTERM"): true => {
      if (signal !== 0)
        this.signals.push(`${processId} ${signal}`);
      if (!isRunning(processId, signal))
        throw ProcessKillFixture.missing();
      return true;
    };
  }

  public static missing(): Error {
    return Object.assign(new Error(`kill ${ProcessKillFixture.MISSING_CODE}`), { code: ProcessKillFixture.MISSING_CODE });
  }

  public real(processId: number, signal: string | number): boolean {
    try {
      return this.kill(process.platform === "win32" ? Math.abs(processId) : processId, signal);
    }
    catch {
      return false;
    }
  }

  public [Symbol.dispose](): void {
    process.kill = this.kill;
  }
}
