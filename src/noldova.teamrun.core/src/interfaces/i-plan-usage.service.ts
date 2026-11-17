/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PlanUsage, PlanWindow } from "@noldova/teamrun.protocol";

export interface IPlanUsageService {
  record(kind: string, providerId: string | null, windows: readonly PlanWindow[], readAt: string, plan?: string | null): PlanUsage;
  list(): readonly PlanUsage[];
}
