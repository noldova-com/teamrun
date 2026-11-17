/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ClockService } from "../../src/app/services/clock.service";

export class FakeClock extends ClockService {
  private readonly ticks: Map<() => void, number> = new Map();
  private readonly timeouts: Map<() => void, number> = new Map();
  private time: number;

  public constructor(time: number) {
    super();
    this.time = time;
  }

  public get running(): number {
    return this.ticks.size;
  }

  public get intervals(): number[] {
    return [...this.ticks.values()];
  }

  public get remaining(): number[] {
    return [...this.timeouts.values()].map(t => t - this.time);
  }

  public override now(): number {
    return this.time;
  }

  public override every(milliseconds: number, tick: () => void): () => void {
    this.ticks.set(tick, milliseconds);
    return () => this.ticks.delete(tick);
  }

  public override after(milliseconds: number, done: () => void): () => void {
    const timeout = (): void => done();
    this.timeouts.set(timeout, this.time + milliseconds);
    return () => this.timeouts.delete(timeout);
  }

  public advance(milliseconds: number): void {
    this.time += milliseconds;
    for (const tick of this.ticks.keys())
      tick();
    for (const [timeout, due] of [...this.timeouts])
      if (due <= this.time) {
        this.timeouts.delete(timeout);
        timeout();
      }
  }
}
