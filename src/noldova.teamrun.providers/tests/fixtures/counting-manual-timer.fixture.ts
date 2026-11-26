/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ManualTimer } from "@noldova/teamrun.core/testing";

export class CountingManualTimer extends ManualTimer {
  private readonly counted: number;
  private countedBegun: number = 0;

  public constructor(counted: number) {
    super();
    this.counted = counted;
  }

  public get begunOfCounted(): number {
    return this.countedBegun;
  }

  public override delayAsync(milliseconds: number, signal: AbortSignal): Promise<void> {
    if (milliseconds === this.counted)
      this.countedBegun++;
    return super.delayAsync(milliseconds, signal);
  }
}
