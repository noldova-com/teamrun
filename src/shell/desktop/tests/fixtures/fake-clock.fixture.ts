/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

interface IFakeTimer {
  readonly due: number;
  readonly resolve: () => void;
}

export class FakeClock {
  private readonly timers: IFakeTimer[] = [];
  private time: number = 0;

  public readonly waits: number[] = [];

  public get pending(): number {
    return this.timers.length;
  }

  public now(): number {
    return this.time;
  }

  public waitAsync(milliseconds: number, signal: AbortSignal): Promise<void> {
    this.waits.push(milliseconds);
    return new Promise((resolve, reject) => {
      const abort = (): void => {
        this.timers.splice(this.timers.indexOf(timer), 1);
        reject(signal.reason as Error);
      };
      const timer: IFakeTimer = {
        due: this.time + milliseconds,
        resolve: () => {
          signal.removeEventListener("abort", abort);
          resolve();
        }
      };
      this.timers.push(timer);
      signal.addEventListener("abort", abort, { once: true });
    });
  }

  public advance(milliseconds: number): void {
    this.time += milliseconds;
    for (const timer of this.timers.filter(t => t.due <= this.time)) {
      this.timers.splice(this.timers.indexOf(timer), 1);
      timer.resolve();
    }
  }
}
