/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { TurnDetail } from "@noldova/teamrun.core";
import { DetailKind, PlanStep, type PlanStepStatus, ReplyPlan } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";

export class PlanDetails {
  public static step(text: unknown, status: PlanStepStatus, activeText: unknown): PlanStep | null {
    if (!Object.isString(text) || String.isNullOrWhitespace(text))
      return null;
    return new PlanStep(text, status, Object.isString(activeText) && !String.isNullOrWhitespace(activeText) ? activeText : null);
  }

  public static statusOf(statuses: Readonly<Record<string, PlanStepStatus>>, status: unknown, fallback: PlanStepStatus): PlanStepStatus {
    return Object.isString(status) && Object.hasOwn(statuses, status) ? statuses[status]! : fallback;
  }

  public static detail(steps: readonly (PlanStep | null)[], explanation: JsonValue | undefined, id: string): TurnDetail {
    const plan = new ReplyPlan(steps.filter(t => !Object.isNull(t)), Object.isString(explanation) ? explanation : null);
    return new TurnDetail(DetailKind.Plan, Resources.formatPlanDetail(plan.completedCount, plan.steps.length), plan.toJson(), id);
  }

  public static text(text: unknown, rejected: boolean = false, approved: boolean = false): TurnDetail | null {
    if (!Object.isString(text) || String.isNullOrWhitespace(text))
      return null;
    const plan = new ReplyPlan([], null, text, rejected, approved);
    return new TurnDetail(DetailKind.Plan, plan.title!, plan.toJson(), Resources.planTextDetailId);
  }
}
