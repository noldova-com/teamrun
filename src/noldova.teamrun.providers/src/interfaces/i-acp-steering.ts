/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonReader, JsonValue } from "@noldova/context.json";
import type { TurnSteer } from "@noldova/teamrun.core";

export interface IAcpSteering {
  readonly methods: readonly string[];
  paramsOf(sessionId: string, steer: TurnSteer, blocks: readonly JsonValue[]): JsonObject | null;
  took(result: JsonReader): boolean;
}
