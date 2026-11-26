/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonReader } from "@noldova/context.json";

import type { AcpPlan } from "../models/acp-plan.js";

export interface IAcpPlanReader {
  readonly methods: readonly string[];
  readonly nativeKind: string;
  readonly leavesPlan: boolean;
  read(params: JsonReader): AcpPlan | null;
  reply(params: JsonReader, approved: boolean | null): JsonObject;
}
