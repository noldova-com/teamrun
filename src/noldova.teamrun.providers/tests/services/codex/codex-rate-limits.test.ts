/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { PlanWindow } from "@noldova/teamrun.protocol";
import { CodexRateLimits } from "@noldova/teamrun.providers";

@TestClass
export class CodexRateLimitsTests {
  @TestMethod
  public namesTheFiveHourAndWeeklyWindowsByTheirLength(): void {
    const limits = new CodexRateLimits();

    const windows = limits.merge({ limitId: "codex", primary: { usedPercent: 12, windowDurationMins: 300, resetsAt: 1_792_656_000 },
      secondary: { usedPercent: 40.5, windowDurationMins: 10080, resetsAt: null } });

    Assert.areEqual("FiveHour 12 2026-10-22T08:00:00.000Z,Weekly 40.5 null", CodexRateLimitsTests.format(windows));
  }

  @TestMethod
  public keepsEarlierWindowsThatALaterReportLeavesOut(): void {
    const limits = new CodexRateLimits();

    limits.merge({ limitId: null, primary: { usedPercent: 12, windowDurationMins: 300 }, secondary: null });
    const merged = limits.merge({ secondary: { usedPercent: 41, windowDurationMins: 10080 } });
    const replaced = limits.merge({ primary: { usedPercent: 15, windowDurationMins: 300 } });

    Assert.areEqual("FiveHour 12 null,Weekly 41 null", CodexRateLimitsTests.format(merged));
    Assert.areEqual("FiveHour 15 null,Weekly 41 null", CodexRateLimitsTests.format(replaced));
  }

  @TestMethod
  public dropsOtherLimitsAndWindowsItCannotName(): void {
    const limits = new CodexRateLimits();

    const other = limits.merge({ limitId: "codex_other_model", primary: { usedPercent: 90, windowDurationMins: 300 } });
    const unnamed = limits.merge({ primary: { usedPercent: 5, windowDurationMins: 60 }, secondary: { usedPercent: "5", windowDurationMins: 10080 } });

    Assert.isNull(other);
    Assert.isNull(limits.merge("rate limits"));
    Assert.isNull(limits.merge(undefined));
    Assert.areEqual("", CodexRateLimitsTests.format(unnamed));
  }

  @TestMethod
  public readsTheCreditsAsUnlimitedOrTheirBalanceAndHidesThemWithoutCredits(): void {
    const limits = new CodexRateLimits();

    const unlimited = limits.merge({ primary: { usedPercent: 12, windowDurationMins: 300 }, credits: { hasCredits: true, unlimited: true, balance: null } });
    const balance = limits.merge({ credits: { hasCredits: true, unlimited: false, balance: " 12.5 " } });
    const kept = limits.merge({ credits: null });
    const none = limits.merge({ credits: { hasCredits: false, unlimited: false, balance: "40" } });

    Assert.areEqual("FiveHour 12 null,Credits unlimited", CodexRateLimitsTests.formatCredits(unlimited));
    Assert.areEqual("FiveHour 12 null,Credits 12.5", CodexRateLimitsTests.formatCredits(balance));
    Assert.areEqual("FiveHour 12 null,Credits 12.5", CodexRateLimitsTests.formatCredits(kept));
    Assert.areEqual("FiveHour 12 null", CodexRateLimitsTests.formatCredits(none));
  }

  @TestMethod
  public hidesCreditsWhoseBalanceItCannotRead(): void {
    for (const balance of [null, "", " ", "plenty", "-3", 12]) {
      const limits = new CodexRateLimits();
      limits.merge({ credits: { hasCredits: true, unlimited: false, balance: "1" } });

      Assert.areEqual("", CodexRateLimitsTests.formatCredits(limits.merge({ credits: { hasCredits: true, unlimited: false, balance } })), String(balance));
    }
  }

  private static formatCredits(windows: readonly PlanWindow[] | null): string {
    return (windows ?? []).map(t => t.name === "Credits" ? `${t.name} ${t.unlimited ? "unlimited" : t.balance}` : `${t.name} ${t.usedPercent} ${t.resetsAt}`)
      .join(",");
  }

  private static format(windows: readonly PlanWindow[] | null): string {
    return (windows ?? []).map(t => `${t.name} ${t.usedPercent} ${t.resetsAt}`).join(",");
  }
}
