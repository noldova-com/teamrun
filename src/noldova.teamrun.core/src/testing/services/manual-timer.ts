/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ITimer } from "../../interfaces/i-timer.js";
import { ManualDelay } from "../models/manual-delay.js";

export class ManualTimer implements ITimer {
  private readonly delays: Set<ManualDelay> = new Set();
  private time: number = 0;
  private elapsed: number = 0;
  private added: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private begunCount: number = 0;

  public get pending(): number {
    return this.delays.size;
  }

  public get begun(): number {
    return this.begunCount;
  }

  public pendingWithin(milliseconds: number): number {
    return [...this.delays].filter(t => t.deadline <= this.elapsed + milliseconds).length;
  }

  public get delayed(): Promise<void> {
    return this.added.promise;
  }

  public now(): number {
    return this.time;
  }

  public delayAsync(milliseconds: number, signal: AbortSignal): Promise<void> {
    const delay = new ManualDelay(this.elapsed + milliseconds);
    this.delays.add(delay);
    this.begunCount++;
    this.added.resolve();
    this.added = Promise.withResolvers<void>();
    signal.addEventListener("abort", () => {
      this.delays.delete(delay);
      delay.cancel(signal.reason);
    }, { once: true });
    return delay.promise;
  }

  public advance(milliseconds: number): void {
    this.time += milliseconds;
    this.elapsed += milliseconds;
    for (const delay of [...this.delays].filter(t => t.deadline <= this.elapsed)) {
      this.delays.delete(delay);
      delay.elapse();
    }
  }

  public jump(milliseconds: number): void {
    this.time += milliseconds;
  }
}
