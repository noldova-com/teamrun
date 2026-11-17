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
import { PlanUsage, PlanUsageParams, PlanWindow, PlanWindowName } from "@noldova/teamrun.protocol";

@TestClass
export class PlanUsageTests {
  private static readonly usage: object = {
    kind: "codex", providerId: "acc-1",
    windows: [
      { name: "FiveHour", usedPercent: 42.5, resetsAt: "2026-10-22T05:00:00.000Z", used: null, allowance: null, unlimited: false, balance: null },
      { name: "MonthlyPremiumRequests", usedPercent: 101, resetsAt: null, used: 303.5, allowance: 300, unlimited: false, balance: null },
      { name: "MonthlyChatRequests", usedPercent: null, resetsAt: null, used: null, allowance: null, unlimited: true, balance: null },
      { name: "Credits", usedPercent: null, resetsAt: null, used: null, allowance: null, unlimited: false, balance: 12.5 }
    ],
    readAt: "2026-10-22T01:00:00.000Z",
    plan: "pro",
    usedUp: true,
    usedUpUntil: "2026-10-22T05:00:00.000Z"
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const usage = PlanUsage.fromJson(PlanUsageTests.usage);
    const params = { kind: "claude", providerId: null };

    Assert.areEqual(JSON.stringify(PlanUsageTests.usage), JSON.stringify(usage.toJson()));
    Assert.areEqual(PlanWindowName.FiveHour, usage.windows[0]!.name);
    Assert.areEqual(300, usage.windows[1]!.allowance);
    Assert.isTrue(usage.windows[2]!.unlimited);
    Assert.areEqual(12.5, usage.windows[3]!.balance);
    Assert.areEqual("true 2026-10-22T05:00:00.000Z", `${usage.usedUp} ${usage.usedUpUntil}`);
    Assert.areEqual(JSON.stringify(params), JSON.stringify(PlanUsageParams.fromJson(params).toJson()));
  }

  @TestMethod
  public readsAnOlderReportWithNoPlanAsNoneAndRefusesABlankOne(): void {
    const { plan, ...older } = PlanUsageTests.usage as { plan: string };

    Assert.areEqual("pro", plan);
    Assert.isNull(PlanUsage.fromJson(older).plan);
    Assert.isNull(new PlanUsage("codex", null, [], "2026-10-22T01:00:00.000Z").plan);
    Assert.isNull(PlanUsage.fromJson({ ...older, plan: null }).plan);
    Assert.throws(() => new PlanUsage("codex", null, [], "2026-10-22T01:00:00.000Z", " "), ArgumentException);
    Assert.throws(() => PlanUsage.fromJson({ ...older, plan: 1 }), JsonException);
  }

  @TestMethod
  public readsAnOlderReportWithoutTheUsedUpStateAsNotUsedUpAndRefusesAnEndWithoutIt(): void {
    const { usedUp, usedUpUntil, ...older } = PlanUsageTests.usage as { usedUp: boolean; usedUpUntil: string };
    const unknown = PlanUsage.fromJson({ ...older, usedUp: true, usedUpUntil: null });

    Assert.isTrue(usedUp);
    Assert.areEqual("false null", `${PlanUsage.fromJson(older).usedUp} ${PlanUsage.fromJson(older).usedUpUntil}`);
    Assert.areEqual("false null", `${new PlanUsage("codex", null, [], "2026-10-22T01:00:00.000Z").usedUp} ${new PlanUsage("codex", null, [], "2026-10-22T01:00:00.000Z").usedUpUntil}`);
    Assert.areEqual("true null", `${unknown.usedUp} ${unknown.usedUpUntil}`);
    Assert.throws(() => new PlanUsage("codex", null, [], "2026-10-22T01:00:00.000Z", null, false, usedUpUntil), ArgumentException);
    Assert.throws(() => new PlanUsage("codex", null, [], "2026-10-22T01:00:00.000Z", null, true, " "), ArgumentException);
    Assert.throws(() => PlanUsage.fromJson({ ...older, usedUp: "yes" }), JsonException);
  }

  @TestMethod
  public findsAWindowUsedUpWhenItsPercentRoundsToAWholeWindowOrElseItsCountReachesItsAllowance(): void {
    const windows = [new PlanWindow(PlanWindowName.FiveHour, 99.4, null), new PlanWindow(PlanWindowName.FiveHour, 99.5, null), new PlanWindow(PlanWindowName.Weekly, 140, null),
      new PlanWindow(PlanWindowName.MonthlyPremiumRequests, null, null, 299, 300), new PlanWindow(PlanWindowName.MonthlyPremiumRequests, null, null, 300, 300),
      new PlanWindow(PlanWindowName.MonthlyPremiumRequests, 50, null, 300, 300), new PlanWindow(PlanWindowName.MonthlyPremiumRequests, null, null, 0, 0),
      new PlanWindow(PlanWindowName.MonthlyChatRequests, null, null, null, null, true), new PlanWindow(PlanWindowName.Credits, null, null, null, null, false, 0)];

    Assert.areEqual("false,true,true,false,true,false,false,false,false", windows.map(t => t.isUsedUp).join());
  }

  @TestMethod
  public refusesBadWindowsAndNames(): void {
    const week = new PlanWindow(PlanWindowName.Weekly, 1, null);

    Assert.throws(() => new PlanWindow(PlanWindowName.Weekly, -1, null), ArgumentException);
    Assert.throws(() => new PlanWindow(PlanWindowName.Weekly, Number.POSITIVE_INFINITY, null), ArgumentException);
    Assert.throws(() => new PlanWindow(PlanWindowName.Weekly, 1, " "), ArgumentException);
    Assert.throws(() => new PlanWindow(PlanWindowName.Weekly, null, null), ArgumentException);
    Assert.throws(() => new PlanWindow(PlanWindowName.Weekly, 1, null, null, null, true), ArgumentException);
    Assert.throws(() => new PlanWindow(PlanWindowName.Credits, null, null, null, null, true, 1), ArgumentException);
    Assert.throws(() => new PlanWindow(PlanWindowName.MonthlyPremiumRequests, null, null, 1, null), ArgumentException);
    Assert.throws(() => new PlanWindow(PlanWindowName.MonthlyPremiumRequests, null, null, null, 1), ArgumentException);
    Assert.throws(() => new PlanWindow(PlanWindowName.MonthlyPremiumRequests, null, null, -1, 1), ArgumentException);
    Assert.throws(() => new PlanWindow(PlanWindowName.MonthlyPremiumRequests, null, null, 1, Number.POSITIVE_INFINITY), ArgumentException);
    Assert.throws(() => new PlanWindow(PlanWindowName.Credits, null, null, null, null, false, -1), ArgumentException);
    Assert.throws(() => new PlanWindow(PlanWindowName.Credits, null, null, null, null, false, Number.NaN), ArgumentException);
    Assert.throws(() => new PlanUsage("codex", null, [week, week], "2026-10-22T01:00:00.000Z"), ArgumentException);
    Assert.throws(() => new PlanUsage("codex", " ", [], "2026-10-22T01:00:00.000Z"), ArgumentException);
    Assert.throws(() => new PlanUsage("codex", null, [], " "), ArgumentException);
    Assert.throws(() => new PlanUsageParams("codex", " "), ArgumentException);
    Assert.throws(() => PlanWindow.fromJson({ name: "Daily", usedPercent: 1, resetsAt: null, used: null, allowance: null, unlimited: false, balance: null }),
      JsonException);
    Assert.throws(() => PlanWindow.fromJson({ name: "Weekly", usedPercent: 1, resetsAt: null }), JsonException);
  }
}
