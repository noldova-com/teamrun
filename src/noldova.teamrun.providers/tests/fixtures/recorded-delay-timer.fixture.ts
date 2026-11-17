/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ITimer } from "@noldova/teamrun.core";

export class RecordedDelayTimer implements ITimer {
  public readonly delays: number[] = [];

  public now(): number {
    return this.delays.reduce((total, delay) => total + delay, 0);
  }

  public delayAsync(milliseconds: number): Promise<void> {
    this.delays.push(milliseconds);
    return Promise.resolve();
  }
}
