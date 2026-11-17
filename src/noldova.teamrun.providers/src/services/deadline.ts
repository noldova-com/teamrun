/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { ITimer } from "@noldova/teamrun.core";

export class Deadline {
  private readonly timer: ITimer;
  private readonly limit: number;
  private readonly elapsed: () => void;
  private wait: AbortController | null = null;

  public constructor(timer: ITimer, limit: number, elapsed: () => void) {
    this.timer = timer;
    this.limit = limit;
    this.elapsed = elapsed;
  }

  public get isRunning(): boolean {
    return !Object.isNull(this.wait);
  }

  public start(): void {
    this.stop();
    const wait = new AbortController();
    this.wait = wait;
    void this.timer.delayAsync(this.limit, wait.signal).then(() => {
      if (wait.signal.aborted)
        return;
      this.wait = null;
      this.elapsed();
    }, () => undefined);
  }

  public extend(): void {
    if (this.isRunning)
      this.start();
  }

  public stop(): void {
    this.wait?.abort();
    this.wait = null;
  }
}
