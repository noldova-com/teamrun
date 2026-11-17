/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DetailKind, MessageDetail, PlanStep, PlanStepStatus, ReplyPlan } from "@noldova/teamrun.protocol";

@TestClass
export class ReplyPlanTests {
  @TestMethod
  public countsItsDoneStepsAndKeepsABlankExplanationAsNone(): void {
    const plan = new ReplyPlan([new PlanStep("Read the code", PlanStepStatus.Completed, null), new PlanStep("Fix the bug", PlanStepStatus.InProgress, "Fixing the bug"),
      new PlanStep("Run the tests", PlanStepStatus.Pending, null)], "Found the cause");

    Assert.areEqual("1 of 3|Found the cause", `${plan.completedCount} of ${plan.steps.length}|${plan.explanation}`);
    Assert.isNull(new ReplyPlan([], " ").explanation);
  }

  @TestMethod
  public keepsAnEmptyPlan(): void {
    const plan = ReplyPlan.fromJson({ steps: [], explanation: null });

    Assert.areEqual("0|0", `${plan.steps.length}|${plan.completedCount}`);
  }

  @TestMethod
  public roundTripsThroughJsonAndReportsABadStepByItsPath(): void {
    const json = { steps: [{ text: "Fix the bug", status: "InProgress", activeText: "Fixing the bug" }], explanation: "Found the cause", text: "# Fix the bug" };
    const bad = Assert.throws(() => ReplyPlan.fromJson({ steps: [{ text: "", status: "Pending", activeText: null }], explanation: null }), JsonException);

    Assert.areEqual(JSON.stringify(json), JSON.stringify(ReplyPlan.fromJson(json).toJson()));
    Assert.areEqual("$.steps.0.text", bad.path);
  }

  @TestMethod
  public readsAChecklistStoredBeforePlansHadText(): void {
    const plan = ReplyPlan.fromJson({ steps: [{ text: "Read", status: "Pending", activeText: null }], explanation: null });

    Assert.areEqual("null|null|1", `${plan.text}|${plan.title}|${plan.steps.length}`);
  }

  @TestMethod
  public titlesAPlanByItsFirstLineWithoutTheHeadingMarks(): void {
    const title = (text: string): string | null => new ReplyPlan([], null, text).title;

    Assert.areEqual("Move the cache", title("\n\n## Move the cache\n\n1. Read it"));
    Assert.areEqual("Read the code first", title("  Read the code first  \nThen fix it"));
    Assert.areEqual("#hashtag", title("#hashtag"));
    Assert.isNull(title(" \n "));
  }

  @TestMethod
  public mergesAReplysLatestPlanTextWithItsLatestChecklist(): void {
    const detail = (sequence: number, plan: ReplyPlan): MessageDetail => new MessageDetail(sequence, DetailKind.Plan, "plan", plan.toJson(), "t");
    const step = (text: string, status: PlanStepStatus): PlanStep => new PlanStep(text, status, null);
    const merged = ReplyPlan.ofDetails([
      detail(0, new ReplyPlan([], null, "# First")),
      new MessageDetail(1, DetailKind.Text, "# Not a plan", null, "t"),
      detail(2, new ReplyPlan([step("Read", PlanStepStatus.Completed)], "Old")),
      detail(3, new ReplyPlan([], null, "# Second")),
      new MessageDetail(4, DetailKind.Plan, "broken", { steps: "no" }, "t"),
      detail(5, new ReplyPlan([step("Read", PlanStepStatus.Completed), step("Fix", PlanStepStatus.Pending)], "New"))])!;

    const checklist = ReplyPlan.ofDetails([detail(0, new ReplyPlan([step("Read", PlanStepStatus.Pending)], null))])!;

    Assert.areEqual("Second|1 of 2|New", `${merged.title}|${merged.completedCount} of ${merged.steps.length}|${merged.explanation}`);
    Assert.areEqual("null|1", `${checklist.text}|${checklist.steps.length}`);
    Assert.isNull(ReplyPlan.ofDetails([detail(0, new ReplyPlan([], null)), new MessageDetail(1, DetailKind.Plan, "broken", null, "t")]));
  }

  @TestMethod
  public readsASubAgentsOwnPlanApartFromTheReplysPlan(): void {
    const nested = (sequence: number, plan: ReplyPlan): MessageDetail => new MessageDetail(sequence, DetailKind.Plan, "plan", plan.toJson(), "t", 0);
    const agent = new MessageDetail(0, DetailKind.SubAgent, "Explore", null, "t");
    const own = new MessageDetail(2, DetailKind.Plan, "plan", new ReplyPlan([], null, "# The reply's plan").toJson(), "t");

    Assert.isNull(ReplyPlan.ofDetails([agent, nested(1, new ReplyPlan([new PlanStep("Read", PlanStepStatus.Pending, null)], null, "# Its plan"))]));
    Assert.areEqual("The reply's plan|0", `${ReplyPlan.ofDetails([agent, nested(1, new ReplyPlan([], null, "# Its plan")), own])?.title}|`
      + `${ReplyPlan.ofDetails([agent, own, nested(3, new ReplyPlan([new PlanStep("Read", PlanStepStatus.Pending, null)], null))])?.steps.length}`);
    Assert.areEqual("Its plan|1", `${ReplyPlan.ofDetails([agent, nested(1, new ReplyPlan([], null, "# Its plan")), own,
      nested(3, new ReplyPlan([new PlanStep("Read", PlanStepStatus.Pending, null)], null))], 0)?.title}|${ReplyPlan.ofDetails([agent, own, nested(3,
      new ReplyPlan([new PlanStep("Read", PlanStepStatus.Pending, null)], null))], 0)?.steps.length}`);
    Assert.isNull(ReplyPlan.ofDetails([agent, own], 0));
  }

  @TestMethod
  public marksARefusedPlanTextAndReadsAMissingMarkAsNotRefused(): void {
    const detail = (sequence: number, plan: ReplyPlan): MessageDetail => new MessageDetail(sequence, DetailKind.Plan, "plan", plan.toJson(), "t");
    const refused = new ReplyPlan([], null, "# Move the cache", true);
    const step = new PlanStep("Read", PlanStepStatus.Pending, null);
    const shown = (details: readonly MessageDetail[]): string => {
      const plan = ReplyPlan.ofDetails(details)!;
      return `${plan.title}:${plan.rejected}`;
    };

    Assert.areEqual(JSON.stringify({ steps: [], explanation: null, text: "# Move the cache", rejected: true }), JSON.stringify(refused.toJson()));
    Assert.isTrue(ReplyPlan.fromJson(refused.toJson()).rejected);
    Assert.areEqual(JSON.stringify({ steps: [], explanation: null, text: "# Move the cache" }), JSON.stringify(new ReplyPlan([], null, "# Move the cache").toJson()));
    Assert.isFalse(ReplyPlan.fromJson({ steps: [], explanation: null, text: "# Move the cache" }).rejected);
    Assert.isFalse(new ReplyPlan([step], null, null, true).rejected);
    Assert.areEqual("Move the cache:true", shown([detail(0, new ReplyPlan([], null, "# Move the cache")), detail(1, refused), detail(2, new ReplyPlan([step], null))]));
    Assert.areEqual("Move it later:false", shown([detail(0, refused), detail(1, new ReplyPlan([], null, "# Move it later"))]));
    Assert.throws(() => ReplyPlan.fromJson({ steps: [], explanation: null, text: "# Move the cache", rejected: "yes" }), JsonException);
  }

  @TestMethod
  public marksAnApprovedPlanTextOnlyWhenItHasTextAndWasNotRefused(): void {
    const detail = (sequence: number, plan: ReplyPlan): MessageDetail => new MessageDetail(sequence, DetailKind.Plan, "plan", plan.toJson(), "t");
    const approved = new ReplyPlan([], null, "# Move the cache", false, true);
    const step = new PlanStep("Read", PlanStepStatus.Pending, null);

    Assert.areEqual(JSON.stringify({ steps: [], explanation: null, text: "# Move the cache", approved: true }), JSON.stringify(approved.toJson()));
    Assert.isTrue(ReplyPlan.fromJson(approved.toJson()).approved);
    Assert.isFalse(ReplyPlan.fromJson({ steps: [], explanation: null, text: "# Move the cache" }).approved);
    Assert.isFalse(new ReplyPlan([step], null, null, false, true).approved);
    const both = new ReplyPlan([], null, "# Move the cache", true, true);
    Assert.areEqual(JSON.stringify([true, false]), JSON.stringify([both.rejected, both.approved]));
    Assert.isTrue(ReplyPlan.ofDetails([detail(0, new ReplyPlan([], null, "# Move the cache")), detail(1, approved), detail(2, new ReplyPlan([step], null))])!.approved);
    Assert.isFalse(ReplyPlan.ofDetails([detail(0, approved), detail(1, new ReplyPlan([], null, "# Move it later"))])!.approved);
    Assert.throws(() => ReplyPlan.fromJson({ steps: [], explanation: null, text: "# Move the cache", approved: "yes" }), JsonException);
  }
}
