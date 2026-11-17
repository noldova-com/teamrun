/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { TurnDetail } from "@noldova/teamrun.core";
import { PlanStepStatus } from "@noldova/teamrun.protocol";

import type { IClaudePlanStep } from "../../interfaces/i-claude-plan-step.js";
import { Resources } from "../../resources.js";
import { PlanDetails } from "../plan-details.js";

export class ClaudePlan {
  private steps: Map<string, IClaudePlanStep> = new Map();
  private readonly creates: Map<string, IClaudePlanStep> = new Map();
  private readonly updates: Map<string, unknown> = new Map();
  private readonly lists: Set<string> = new Set();
  private readonly texts: Map<string, unknown> = new Map();
  private readonly uses: Set<string> = new Set();

  public static isPlanTool(name: string): boolean {
    return Resources.claudePlanTools.includes(name);
  }

  public static tracks(name: string): boolean {
    return ClaudePlan.isPlanTool(name) || name === Resources.claudeExitPlanModeTool;
  }

  public owns(toolUseId: string): boolean {
    return this.uses.has(toolUseId);
  }

  public noteToolUse(name: string, toolUseId: string, input: unknown): TurnDetail | null {
    this.uses.add(toolUseId);
    if (name === Resources.claudeExitPlanModeTool) {
      const text = ClaudePlan.fieldOf(input, Resources.claudePlanInputField);
      this.texts.set(toolUseId, text);
      return PlanDetails.text(text);
    }
    if (name === Resources.claudeTodoWriteTool) {
      const todos = ClaudePlan.fieldOf(input, Resources.claudeTodosField);
      if (!Array.isArray(todos))
        return null;
      this.steps = new Map(todos.map((t: unknown, index) => [String(index), ClaudePlan.stepOf(ClaudePlan.fieldOf(t, Resources.contentField),
        ClaudePlan.fieldOf(t, Resources.statusField), ClaudePlan.activeFormOf(t), PlanStepStatus.Pending)]));
      return this.detail();
    }
    if (name === Resources.claudeTaskCreateTool) {
      this.creates.set(toolUseId, ClaudePlan.stepOf(ClaudePlan.fieldOf(input, Resources.claudeSubjectField), undefined, ClaudePlan.activeFormOf(input),
        PlanStepStatus.Pending));
      return null;
    }
    if (name === Resources.claudeTaskUpdateTool)
      this.updates.set(toolUseId, input);
    else if (name === Resources.claudeTaskListTool)
      this.lists.add(toolUseId);
    return null;
  }

  public noteResult(toolUseId: string, isError: boolean, structured: unknown, denied: boolean = false, allowed: boolean = false): TurnDetail | null {
    const text = this.texts.get(toolUseId);
    this.texts.delete(toolUseId);
    if (!Object.isUndefined(text) && !isError)
      return allowed ? PlanDetails.text(text, false, true) : null;
    if (!Object.isUndefined(text))
      return denied ? PlanDetails.text(text, true) : null;
    const create = this.creates.get(toolUseId);
    const update = this.updates.get(toolUseId);
    const listed = this.lists.has(toolUseId);
    this.creates.delete(toolUseId);
    this.updates.delete(toolUseId);
    this.lists.delete(toolUseId);
    if (isError)
      return null;
    if (!Object.isUndefined(update))
      return ClaudePlan.fieldOf(structured, Resources.claudeSuccessField) === false ? null : this.update(update);
    if (listed)
      return this.list(ClaudePlan.fieldOf(structured, Resources.claudeTasksField));
    const id = ClaudePlan.idOf(ClaudePlan.fieldOf(ClaudePlan.fieldOf(structured, Resources.claudeTaskField), Resources.idField));
    if (Object.isUndefined(create) || Object.isNull(id))
      return null;
    this.steps.set(id, create);
    return this.detail();
  }

  private update(input: unknown): TurnDetail | null {
    const id = ClaudePlan.idOf(Resources.claudeTaskIdFields.map(t => ClaudePlan.fieldOf(input, t)).find(t => !Object.isUndefined(t)));
    const step = Object.isNull(id) ? undefined : this.steps.get(id);
    if (Object.isUndefined(step))
      return null;
    const status = ClaudePlan.fieldOf(input, Resources.statusField);
    if (status === Resources.claudeDeletedTaskStatus)
      this.steps.delete(id!);
    else
      this.steps.set(id!, ClaudePlan.stepOf(ClaudePlan.fieldOf(input, Resources.claudeSubjectField) ?? step.text, status, ClaudePlan.activeFormOf(input) ?? step.activeText,
        step.status));
    return this.detail();
  }

  private list(tasks: unknown): TurnDetail | null {
    if (!Array.isArray(tasks))
      return null;
    const steps = new Map<string, IClaudePlanStep>();
    for (const task of tasks) {
      const id = ClaudePlan.idOf(ClaudePlan.fieldOf(task, Resources.idField));
      if (!Object.isNull(id))
        steps.set(id, ClaudePlan.stepOf(ClaudePlan.fieldOf(task, Resources.claudeSubjectField), ClaudePlan.fieldOf(task, Resources.statusField),
          this.steps.get(id)?.activeText, PlanStepStatus.Pending));
    }
    this.steps = steps;
    return this.detail();
  }

  private detail(): TurnDetail {
    return PlanDetails.detail([...this.steps.values()].map(t => PlanDetails.step(t.text, t.status, t.activeText)), undefined, Resources.planDetailId);
  }

  private static stepOf(text: unknown, status: unknown, activeText: unknown, fallback: PlanStepStatus): IClaudePlanStep {
    return { text, status: PlanDetails.statusOf(Resources.claudePlanStatuses, status, fallback), activeText };
  }

  private static activeFormOf(value: unknown): unknown {
    return Resources.claudeActiveFormFields.map(t => ClaudePlan.fieldOf(value, t)).find(t => !Object.isUndefined(t));
  }

  private static idOf(value: unknown): string | null {
    if (typeof value === "number" && Number.isSafeInteger(value))
      return String(value);
    return Object.isString(value) && !String.isNullOrWhitespace(value) ? value : null;
  }

  private static fieldOf(value: unknown, name: string): unknown {
    return Object.isObject(value) && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>)[name] : undefined;
  }
}
