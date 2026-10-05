/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WindowErrorAdmission } from "../enums/window-error-admission.js";

export class WindowErrorLimit {
  private readonly burst: number;
  private readonly period: number;
  private readonly now: () => number;
  private start: number = Number.NEGATIVE_INFINITY;
  private count: number = 0;

  public constructor(burst: number, period: number, now: () => number = Date.now) {
    this.burst = burst;
    this.period = period;
    this.now = now;
  }

  public admit(): WindowErrorAdmission {
    const now = this.now();
    if (now - this.start >= this.period) {
      this.start = now;
      this.count = 0;
    }
    this.count++;
    if (this.count <= this.burst)
      return WindowErrorAdmission.Write;
    return this.count === this.burst + 1 ? WindowErrorAdmission.Notice : WindowErrorAdmission.Drop;
  }
}
