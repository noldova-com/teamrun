/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { DetailKind } from "../enums/detail-kind.js";
import { PlanStepStatus } from "../enums/plan-step-status.js";
import { Resources } from "../resources.js";
import type { MessageDetail } from "./message-detail.js";
import { PlanStep } from "./plan-step.js";

export class ReplyPlan {
  public readonly steps: readonly PlanStep[];
  public readonly explanation: string | null;
  public readonly text: string | null;
  public readonly title: string | null;
  public readonly rejected: boolean;
  public readonly approved: boolean;
  public readonly completedCount: number;

  public constructor(steps: readonly PlanStep[], explanation: string | null, text: string | null = null, rejected: boolean = false,
    approved: boolean = false) {
    this.steps = [...steps];
    this.explanation = String.isNullOrWhitespace(explanation) ? null : explanation;
    this.text = Object.isNull(text) || String.isNullOrWhitespace(text) ? null : text.trim();
    this.title = Object.isNull(this.text) ? null : ReplyPlan.titleOf(this.text);
    this.rejected = rejected && !Object.isNull(this.text);
    this.approved = approved && !this.rejected && !Object.isNull(this.text);
    this.completedCount = steps.filter(t => t.status === PlanStepStatus.Completed).length;
  }

  public get isEmpty(): boolean {
    return Object.isNull(this.text) && this.steps.length === 0;
  }

  public static ofDetails(details: readonly MessageDetail[], parentSequence: number | null = null): ReplyPlan | null {
    const plans = details.filter(t => t.kind === DetailKind.Plan && t.parentSequence === parentSequence).flatMap(t => {
      try {
        return [ReplyPlan.fromJson(t.payload)];
      }
      catch {
        return [];
      }
    });
    const text = plans.findLast(t => !Object.isNull(t.text));
    const checklist = plans.findLast(t => t.steps.length > 0);
    const plan = new ReplyPlan(checklist?.steps ?? [], checklist?.explanation ?? null, text?.text ?? null, text?.rejected ?? false,
      text?.approved ?? false);
    return plan.isEmpty ? null : plan;
  }

  public static fromJson(value: unknown, path?: string): ReplyPlan {
    const reader = JsonReader.fromValue(value, path);
    return new ReplyPlan(
      reader.readObjectArray(Resources.stepsField).map(t => PlanStep.fromJson(t.toJson(), t.path)),
      reader.readNullableString(Resources.explanationField),
      reader.hasField(Resources.textField) ? reader.readNullableString(Resources.textField) : null,
      reader.hasField(Resources.rejectedField) && reader.readBoolean(Resources.rejectedField),
      reader.hasField(Resources.approvedField) && reader.readBoolean(Resources.approvedField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.stepsField]: this.steps.map(t => t.toJson()),
      [Resources.explanationField]: this.explanation,
      [Resources.textField]: this.text,
      ...this.rejected ? { [Resources.rejectedField]: true } : {},
      ...this.approved ? { [Resources.approvedField]: true } : {}
    };
  }

  private static titleOf(text: string): string {
    const line = text.split(Resources.lineSeparator).map(t => t.trim()).find(t => t.length > 0)!;
    return line.replace(Resources.planHeadingMarker, String.empty).trim();
  }
}
