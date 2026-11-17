/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import timers from "node:timers/promises";

import type { ITimer } from "../interfaces/i-timer.js";

export class NodeTimer implements ITimer {
  public now(): number {
    return Date.now();
  }

  public async delayAsync(milliseconds: number, signal: AbortSignal): Promise<void> {
    await timers.setTimeout(milliseconds, undefined, { signal });
  }
}
