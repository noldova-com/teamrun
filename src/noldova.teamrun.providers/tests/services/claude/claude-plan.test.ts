/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { TurnDetail } from "@noldova/teamrun.core";
import { DetailKind, ReplyPlan } from "@noldova/teamrun.protocol";
import { ClaudePlan, Resources } from "@noldova/teamrun.providers";

@TestClass
export class ClaudePlanTests {
  @TestMethod
  public takesTodoWritesWholeListEachTimeAndShowsAStepInProgressByItsActiveForm(): void {
    const plan = new ClaudePlan();
    const first = plan.noteToolUse("TodoWrite", "tu-1", { todos: [{ content: "Read the code", status: "completed", activeForm: "Reading the code" },
      { content: "Fix the bug", status: "in_progress", activeForm: "Fixing the bug" }, { content: "Run the tests", status: "pending", activeForm: "Running the tests" }] });
    const second = plan.noteToolUse("TodoWrite", "tu-2", { todos: [{ content: "Fix the bug", status: "completed" }, { content: " ", status: "pending" },
      { content: "Ship it", status: "blocked" }] });

    Assert.areEqual("Plan, 1 of 3 done|Read the code:Completed:Reading the code,Fix the bug:InProgress:Fixing the bug,Run the tests:Pending:Running the tests",
      ClaudePlanTests.describe(first));
    Assert.areEqual("Plan, 1 of 2 done|Fix the bug:Completed:null,Ship it:Pending:null", ClaudePlanTests.describe(second));
    Assert.areEqual(`${DetailKind.Plan}:${Resources.planDetailId}`, `${second!.kind}:${second!.providerItemId}`);
    Assert.isTrue(plan.owns("tu-1") && !plan.owns("tu-3"));
    Assert.isNull(plan.noteToolUse("TodoWrite", "tu-3", { todos: "none" }));
  }

  @TestMethod
  public addsATaskUnderTheIdItsResultNamesThenUpdatesOrDeletesItByAnyOfItsIdNames(): void {
    const plan = new ClaudePlan();

    Assert.isNull(plan.noteToolUse("TaskCreate", "tu-1", { subject: "Fix the bug", activeForm: "Fixing the bug" }));
    const created = plan.noteResult("tu-1", false, { task: { id: "1", subject: "Fix the bug" } });
    plan.noteToolUse("TaskCreate", "tu-2", { subject: "Run the tests", active_form: "Running the tests" });
    plan.noteResult("tu-2", false, { task: { id: 2 } });
    plan.noteToolUse("TaskCreate", "tu-3", { subject: "Refused" });
    const refused = plan.noteResult("tu-3", true, { task: { id: "3" } });
    plan.noteToolUse("TaskCreate", "tu-9", { subject: "Unnamed" });
    const unnamed = plan.noteResult("tu-9", false, { task: {} });
    plan.noteToolUse("TaskGet", "tu-10", { taskId: "1" });
    const got = plan.noteResult("tu-10", false, { task: { id: "1", subject: "Fix the bug" } });
    const updated = (toolUseId: string, input: unknown): TurnDetail | null => {
      Assert.isNull(plan.noteToolUse("TaskUpdate", toolUseId, input));
      return plan.noteResult(toolUseId, false, { success: true });
    };
    const started = updated("tu-4", { taskId: "1", status: "in_progress" });
    const renamed = updated("tu-5", { task_id: "1", status: "completed", subject: "Fix the parser" });
    const moved = updated("tu-6", { id: "2", status: "in_progress", activeForm: "Testing" });
    const unknown = updated("tu-7", { taskId: "9", status: "completed" });
    const idless = updated("tu-11", { status: "completed" });
    const deleted = updated("tu-8", { taskId: "1", status: "deleted" });

    Assert.areEqual("Plan, 0 of 1 done|Fix the bug:Pending:Fixing the bug", ClaudePlanTests.describe(created));
    Assert.isNull(refused);
    Assert.isNull(unnamed);
    Assert.isNull(got);
    Assert.areEqual("Plan, 0 of 2 done|Fix the bug:InProgress:Fixing the bug,Run the tests:Pending:Running the tests", ClaudePlanTests.describe(started));
    Assert.areEqual("Plan, 1 of 2 done|Fix the parser:Completed:Fixing the bug,Run the tests:Pending:Running the tests", ClaudePlanTests.describe(renamed));
    Assert.areEqual("Plan, 1 of 2 done|Fix the parser:Completed:Fixing the bug,Run the tests:InProgress:Testing", ClaudePlanTests.describe(moved));
    Assert.isNull(unknown);
    Assert.isNull(idless);
    Assert.areEqual("Plan, 0 of 1 done|Run the tests:InProgress:Testing", ClaudePlanTests.describe(deleted));
  }

  @TestMethod
  public appliesATaskUpdateOnlyOnceItsResultSaysItSucceeded(): void {
    const plan = new ClaudePlan();
    plan.noteToolUse("TaskCreate", "tu-1", { subject: "Fix the bug" });
    plan.noteResult("tu-1", false, { task: { id: "1" } });

    plan.noteToolUse("TaskUpdate", "tu-2", { taskId: "1", status: "completed" });
    const failed = plan.noteResult("tu-2", true, null);
    plan.noteToolUse("TaskUpdate", "tu-3", { taskId: "1", status: "completed" });
    const refused = plan.noteResult("tu-3", false, { success: false, error: "No such task" });
    plan.noteToolUse("TaskUpdate", "tu-4", { taskId: "1", status: "in_progress" });
    const applied = plan.noteResult("tu-4", false, undefined);

    Assert.isNull(failed);
    Assert.isNull(refused);
    Assert.areEqual("Plan, 0 of 1 done|Fix the bug:InProgress:null", ClaudePlanTests.describe(applied));
  }

  @TestMethod
  public takesTaskListsTasksAsTheWholeListKeepingAKnownTasksActiveForm(): void {
    const plan = new ClaudePlan();
    plan.noteToolUse("TaskCreate", "tu-1", { subject: "Fix the bug", activeForm: "Fixing the bug" });
    plan.noteResult("tu-1", false, { task: { id: "1" } });

    Assert.isNull(plan.noteToolUse("TaskList", "tu-2", {}));
    const listed = plan.noteResult("tu-2", false, { tasks: [{ id: "1", subject: "Fix the bug", status: "in_progress", blockedBy: [] },
      { id: 4, subject: "Write the notes", status: "pending", blockedBy: [] }, { subject: "No id", status: "pending" }] });
    plan.noteToolUse("TaskUpdate", "tu-3", { taskId: "4", status: "completed" });
    const updated = plan.noteResult("tu-3", false, { success: true });
    plan.noteToolUse("TaskList", "tu-4", {});
    const unreadable = plan.noteResult("tu-4", false, { tasks: "none" });

    Assert.areEqual("Plan, 0 of 2 done|Fix the bug:InProgress:Fixing the bug,Write the notes:Pending:null", ClaudePlanTests.describe(listed));
    Assert.areEqual("Plan, 1 of 2 done|Fix the bug:InProgress:Fixing the bug,Write the notes:Completed:null", ClaudePlanTests.describe(updated));
    Assert.isNull(unreadable);
  }

  @TestMethod
  public namesOnlyTheToDoToolsAsPlanTools(): void {
    Assert.areEqual("true,true,true,true,true,false,false", ["TodoWrite", "TaskCreate", "TaskUpdate", "TaskGet", "TaskList", "Task", "TaskOutput"]
      .map(t => ClaudePlan.isPlanTool(t)).join(","));
  }

  private static describe(detail: TurnDetail | null): string {
    if (detail === null)
      return "null";
    const plan = ReplyPlan.fromJson(detail.payload);
    return `${detail.text}|${plan.steps.map(t => `${t.text}:${t.status}:${String(t.activeText)}`).join(",")}`;
  }
}
