/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonReader } from "@noldova/context.json";
import { PlanStepStatus } from "@noldova/teamrun.protocol";

import type { IAcpPlanReader } from "../../interfaces/i-acp-plan.reader.js";
import { AcpPlan } from "../../models/acp-plan.js";
import { Resources } from "../../resources.js";
import { PlanDetails } from "../plan-details.js";

export class CursorPlanReader implements IAcpPlanReader {
  public readonly methods: readonly string[] = Resources.cursorCreatePlanMethods;
  public readonly nativeKind: string = Resources.cursorCreatePlanTool;
  public readonly leavesPlan: boolean = false;

  public read(params: JsonReader): AcpPlan {
    const phases = params.hasField(Resources.cursorPhasesField) ? params.readObjectArray(Resources.cursorPhasesField) : [];
    const todos = [params, ...phases].flatMap(t => t.hasField(Resources.cursorTodosField) ? t.readObjectArray(Resources.cursorTodosField) : []);
    const steps = todos.map(t => PlanDetails.step(t.toJson()[Resources.contentField],
      PlanDetails.statusOf(Resources.acpPlanStatuses, t.toJson()[Resources.statusField], PlanStepStatus.Pending), undefined));
    return new AcpPlan(params.readNonBlankString(Resources.planField), steps.filter(t => !Object.isNull(t)));
  }

  public reply(_params: JsonReader, approved: boolean | null): JsonObject {
    const outcome = Object.isNull(approved) ? Resources.acpCancelled : approved ? Resources.cursorAcceptedOutcome : Resources.cursorRejectedOutcome;
    return { [Resources.cursorOutcomeField]: { [Resources.cursorOutcomeField]: outcome } };
  }
}
