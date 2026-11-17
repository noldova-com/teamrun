/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ITimer, NodeTimer } from "@noldova/teamrun.core";

export class HeldDelayTimer implements ITimer {
  public readonly requested: number[] = [];
  public readonly aborted: number[] = [];
  private readonly held: readonly number[];
  private readonly timer: ITimer = new NodeTimer();

  public constructor(...held: number[]) {
    this.held = held;
  }

  public now(): number {
    return this.timer.now();
  }

  public delayAsync(milliseconds: number, signal: AbortSignal): Promise<void> {
    this.requested.push(milliseconds);
    if (!this.held.includes(milliseconds))
      return this.timer.delayAsync(milliseconds, signal);
    const held = Promise.withResolvers<void>();
    signal.addEventListener("abort", () => {
      this.aborted.push(milliseconds);
      held.reject(signal.reason);
    }, { once: true });
    return held.promise;
  }
}
