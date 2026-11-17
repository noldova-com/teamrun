/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PlanStepStatus } from "@noldova/teamrun.protocol";

export interface IClaudePlanStep {
  readonly text: unknown;
  readonly status: PlanStepStatus;
  readonly activeText: unknown;
}
