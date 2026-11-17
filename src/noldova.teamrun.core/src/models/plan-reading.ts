/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PlanWindow } from "@noldova/teamrun.protocol";

export class PlanReading {
  public readonly windows: readonly PlanWindow[];
  public readonly plan: string | null;

  public constructor(windows: readonly PlanWindow[], plan: string | null = null) {
    this.windows = [...windows];
    this.plan = plan;
  }
}
