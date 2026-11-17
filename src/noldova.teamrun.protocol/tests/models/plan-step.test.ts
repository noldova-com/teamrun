/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PlanStep, PlanStepStatus } from "@noldova/teamrun.protocol";

@TestClass
export class PlanStepTests {
  @TestMethod
  public holdsItsTextStatusAndActiveText(): void {
    const step = new PlanStep("Run the tests", PlanStepStatus.InProgress, "Running the tests");

    Assert.areEqual("Run the tests|InProgress|Running the tests", [step.text, step.status, step.activeText].join("|"));
    Assert.isNull(new PlanStep("Fix the bug", PlanStepStatus.Pending, null).activeText);
  }

  @TestMethod
  public rejectsABlankTextOrABlankActiveText(): void {
    Assert.throws(() => new PlanStep(" ", PlanStepStatus.Pending, null), ArgumentException);
    Assert.throws(() => new PlanStep("Fix the bug", PlanStepStatus.Pending, " "), ArgumentException);
  }

  @TestMethod
  public roundTripsThroughJsonAndReportsAnUnknownStatus(): void {
    const json = { text: "Run the tests", status: "Completed", activeText: null };
    const unknown = Assert.throws(() => PlanStep.fromJson({ ...json, status: "Skipped" }, "$.steps.2"), JsonException);

    Assert.areEqual(JSON.stringify(json), JSON.stringify(PlanStep.fromJson(json).toJson()));
    Assert.areEqual("$.steps.2.status", unknown.path);
  }
}
