/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonReader } from "@noldova/context.json";

import type { AcpGatedTool } from "../models/acp-gated-tool.js";

export interface IAcpToolGate {
  readonly methods: readonly string[];
  metaOf(initialized: JsonReader): JsonObject | null;
  read(params: JsonReader): AcpGatedTool | null;
  readOnly(update: JsonReader): boolean;
  answer(refusal: string | null): JsonObject;
}
