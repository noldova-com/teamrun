/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonReader } from "@noldova/context.json";
import type { PlanStep } from "@noldova/teamrun.protocol";

export interface IAcpPlanReader {
  readonly methods: readonly string[];
  readonly nativeKind: string;
  readonly leavesPlan: boolean;
  read(params: JsonReader): { readonly text: string; readonly steps: readonly PlanStep[] } | null;
  reply(params: JsonReader, approved: boolean | null): JsonObject;
}
