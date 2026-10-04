/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProcessClock } from "@noldova/teamrun-shell-runtime";

export class ProcessClockFixture extends ProcessClock {
  public time: number;
  public clockOffset: number = 0;

  public constructor(time: number) {
    super("1700000000", false);

    this.time = time;
  }

  public override now(): number {
    return this.time;
  }

  public override offset(): number {
    return this.clockOffset;
  }
}
