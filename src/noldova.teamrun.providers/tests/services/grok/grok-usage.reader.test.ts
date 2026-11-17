/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { GrokUsageReader } from "@noldova/teamrun.providers";

@TestClass
export class GrokUsageReaderTests {
  private static readonly reader: GrokUsageReader = new GrokUsageReader();

  @TestMethod
  public asksGrokForItsSessionInfoAndBillingUnderBothMethodNames(): void {
    Assert.areEqual("_x.ai/session/info,x.ai/session/info", GrokUsageReaderTests.reader.contextMethods.join(","));
    Assert.areEqual("_x.ai/billing,x.ai/billing", GrokUsageReaderTests.reader.planMethods.join(","));
  }

  @TestMethod
  public readsTheReplysTokensAndCostFromThePromptsMeta(): void {
    const usage = GrokUsageReaderTests.reader.readReply({ stopReason: "end_turn", _meta: { usage: { inputTokens: 1200, outputTokens: 300, costUsdTicks: 25_000_000 } } });
    const tokensOnly = GrokUsageReaderTests.reader.readReply({ _meta: { usage: { inputTokens: 1200 } } });

    Assert.areEqual("1200 300 0.0025", `${usage?.inputTokens} ${usage?.outputTokens} ${usage?.costUsd}`);
    Assert.areEqual("1200 null null", `${tokensOnly?.inputTokens} ${tokensOnly?.outputTokens} ${tokensOnly?.costUsd}`);
    Assert.isNull(GrokUsageReaderTests.reader.readReply({ stopReason: "end_turn" }));
  }

  @TestMethod
  public readsTheCachedReadCacheCreationAndReasoningTokensWhenThePromptsMetaGivesThem(): void {
    const usage = GrokUsageReaderTests.reader.readReply({ _meta: { usage: { inputTokens: 1200, outputTokens: 300, cachedReadTokens: 900, cacheCreationTokens: 100,
      reasoningTokens: 80 } } });
    const without = GrokUsageReaderTests.reader.readReply({ _meta: { usage: { inputTokens: 1200, cachedReadTokens: -1, reasoningTokens: "some" } } });

    Assert.areEqual("900 100 80", [usage?.cacheReadTokens, usage?.cacheWriteTokens, usage?.reasoningTokens].join(" "));
    Assert.areEqual("null null null", [without?.cacheReadTokens, without?.cacheWriteTokens, without?.reasoningTokens].map(String).join(" "));
  }

  @TestMethod
  public readsTheContextAndItsCompactPointFromTheSessionInfo(): void {
    const context = GrokUsageReaderTests.reader.readContext({ result: { context: { used: 30_000, total: 200_000, usagePct: 15, autoCompactThresholdPercent: 85 } } });
    const over = GrokUsageReaderTests.reader.readContext({ result: { context: { used: 30_000, total: 200_000, autoCompactThresholdPercent: 120 } } });
    const unset = GrokUsageReaderTests.reader.readContext({ result: { context: { used: 30_000, total: 200_000 } } });

    Assert.areEqual("30000/200000/170000", `${context?.usedTokens}/${context?.windowTokens}/${context?.compactAtTokens}`);
    Assert.isNull(over?.compactAtTokens);
    Assert.isNull(unset?.compactAtTokens);
    Assert.isNull(GrokUsageReaderTests.reader.readContext({ context: { used: 30_000, total: 200_000 } }));
  }

  @TestMethod
  public namesTheCreditWindowByItsBillingPeriod(): void {
    const weekly = GrokUsageReaderTests.reader.readPlan({ config: { creditUsagePercent: 37.5, currentPeriod: { type: "USAGE_PERIOD_TYPE_WEEKLY", end: "2026-10-27T00:00:00Z" } } });
    const monthly = GrokUsageReaderTests.reader.readPlan({ config: { creditUsagePercent: 80, currentPeriod: { type: "USAGE_PERIOD_TYPE_MONTHLY" } } });
    const daily = GrokUsageReaderTests.reader.readPlan({ config: { creditUsagePercent: 80, currentPeriod: { type: "USAGE_PERIOD_TYPE_DAILY" } } });

    Assert.areEqual("WeeklyCredits 37.5 2026-10-27T00:00:00.000Z", (weekly ?? []).map(t => `${t.name} ${t.usedPercent} ${t.resetsAt}`).join(","));
    Assert.areEqual("MonthlyCredits 80 null", (monthly ?? []).map(t => `${t.name} ${t.usedPercent} ${t.resetsAt}`).join(","));
    Assert.areEqual(0, daily?.length);
    Assert.isNull(GrokUsageReaderTests.reader.readPlan({ billing: {} }));
  }
}
