/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PlanStep } from "@noldova/teamrun.protocol";

export class AcpPlan {
  public readonly text: string;
  public readonly steps: readonly PlanStep[];

  public constructor(text: string, steps: readonly PlanStep[]) {
    this.text = text;
    this.steps = steps;
  }
}
