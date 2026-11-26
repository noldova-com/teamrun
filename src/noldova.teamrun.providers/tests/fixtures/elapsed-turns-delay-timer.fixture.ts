/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ITimer, NodeTimer } from "@noldova/teamrun.core";

export class ElapsedTurnsDelayTimer implements ITimer {
  public readonly requested: number[] = [];
  private readonly milliseconds: number;
  private readonly held: readonly number[];
  private readonly elapsed: readonly number[];
  private readonly timer: ITimer = new NodeTimer();

  public constructor(milliseconds: number, held: readonly number[], ...elapsed: number[]) {
    this.milliseconds = milliseconds;
    this.held = held;
    this.elapsed = elapsed;
  }

  public now(): number {
    return this.timer.now();
  }

  public delayAsync(milliseconds: number, signal: AbortSignal): Promise<void> {
    this.requested.push(milliseconds);
    const turn = this.requested.filter(t => t === this.milliseconds).length;
    if (milliseconds === this.milliseconds && this.elapsed.includes(turn))
      return Promise.resolve();
    if (milliseconds !== this.milliseconds && !this.held.includes(milliseconds))
      return this.timer.delayAsync(milliseconds, signal);
    const held = Promise.withResolvers<void>();
    signal.addEventListener("abort", () => held.reject(signal.reason), { once: true });
    return held.promise;
  }
}
