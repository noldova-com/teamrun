/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonReader } from "@noldova/context.json";
import type { TurnSteer } from "@noldova/teamrun.core";

import type { IAcpSteering } from "../../interfaces/i-acp-steering.js";
import { Resources } from "../../resources.js";

export class FxSteering implements IAcpSteering {
  public readonly methods: readonly string[] = [Resources.acpSessionPrompt];

  public paramsOf(sessionId: string, steer: TurnSteer): JsonObject | null {
    return steer.attachments.some(t => t.isImage) ? null : { sessionId, prompt: [{ type: Resources.textInputType, text: steer.text }],
      [Resources.acpMetaField]: { [Resources.fxMetaField]: { [Resources.fxSteerField]: true } } };
  }

  public took(result: JsonReader): boolean {
    const meta = result.hasField(Resources.acpMetaField) ? result.readNullableObject(Resources.acpMetaField) : null;
    const fx = meta?.hasField(Resources.fxMetaField) === true ? meta.readNullableObject(Resources.fxMetaField) : null;
    return fx?.toJson()[Resources.fxSteeringField] === Resources.fxAbsorbedSteering;
  }
}
