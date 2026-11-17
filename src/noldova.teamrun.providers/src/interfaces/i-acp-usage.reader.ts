/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import type { ContextUsage, PlanWindow, ReplyUsage } from "@noldova/teamrun.protocol";

export interface IAcpUsageReader {
  readonly contextMethods: readonly string[];
  readonly planMethods: readonly string[];
  readReply(result: JsonValue): ReplyUsage | null;
  readContext(answer: JsonValue): ContextUsage | null;
  readPlan(answer: JsonValue): readonly PlanWindow[] | null;
}
