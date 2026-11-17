/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonReader, JsonValue } from "@noldova/context.json";
import type { TurnSteer } from "@noldova/teamrun.core";

import type { IAcpSteering } from "../../interfaces/i-acp-steering.js";
import { Resources } from "../../resources.js";

export class GrokSteering implements IAcpSteering {
  public readonly methods: readonly string[] = Resources.xaiInterjectMethods;

  public paramsOf(sessionId: string, steer: TurnSteer, blocks: readonly JsonValue[]): JsonObject {
    return { sessionId, text: steer.text, content: [...blocks] };
  }

  public took(_result: JsonReader): boolean {
    return true;
  }
}
