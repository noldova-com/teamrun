/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonReader } from "@noldova/context.json";
import type { PlanStep } from "@noldova/teamrun.protocol";

import type { IAcpPlanReader } from "../../interfaces/i-acp-plan.reader.js";
import { Resources } from "../../resources.js";

export class GrokPlanReader implements IAcpPlanReader {
  public readonly methods: readonly string[] = Resources.xaiExitPlanModeMethods;
  public readonly nativeKind: string = Resources.xaiExitPlanModeTool;
  public readonly leavesPlan: boolean = true;

  public read(params: JsonReader): { readonly text: string; readonly steps: readonly PlanStep[] } | null {
    const text = params.toJson()[Resources.xaiPlanContentField];
    return Object.isString(text) && !String.isNullOrWhitespace(text) ? { text, steps: [] } : null;
  }

  public reply(_params: JsonReader, approved: boolean | null): JsonObject {
    return { [Resources.xaiOutcomeField]: approved === true ? Resources.xaiApprovedOutcome : Resources.acpCancelled };
  }
}
