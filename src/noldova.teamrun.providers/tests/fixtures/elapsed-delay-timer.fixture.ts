/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ITimer, NodeTimer } from "@noldova/teamrun.core";

export class ElapsedDelayTimer implements ITimer {
  private readonly elapsed: readonly number[];
  private readonly timer: ITimer = new NodeTimer();
  public readonly requested: number[] = [];

  public constructor(...elapsed: number[]) {
    this.elapsed = elapsed;
  }

  public now(): number {
    return this.timer.now();
  }

  public delayAsync(milliseconds: number, signal: AbortSignal): Promise<void> {
    this.requested.push(milliseconds);
    return this.elapsed.includes(milliseconds) ? Promise.resolve() : this.timer.delayAsync(milliseconds, signal);
  }
}
