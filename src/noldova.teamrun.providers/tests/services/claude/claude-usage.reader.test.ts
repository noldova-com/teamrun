/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ClaudeUsageReader } from "@noldova/teamrun.providers";
import type { ContextUsage } from "@noldova/teamrun.protocol";

@TestClass
export class ClaudeUsageReaderTests {
  @TestMethod
  public sumsEveryModelsTokensWithItsCacheAndReadsTheCostOnlyWhenBilledPerReply(): void {
    const result = { type: "result", total_cost_usd: 0.12, modelUsage: {
      "claude-opus": { inputTokens: 10, cacheReadInputTokens: 5, cacheCreationInputTokens: 1, outputTokens: 7 },
      "claude-haiku": { inputTokens: 2, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, outputTokens: 3 }
    } };
    const usage = ClaudeUsageReader.readReply(result, true);
    const subscribed = ClaudeUsageReader.readReply(result, false);

    Assert.areEqual("18 10 0.12", `${usage?.inputTokens} ${usage?.outputTokens} ${usage?.costUsd}`);
    Assert.areEqual("18 10 null", `${subscribed?.inputTokens} ${subscribed?.outputTokens} ${subscribed?.costUsd}`);
    Assert.isNull(usage?.context);
    Assert.isNull(ClaudeUsageReader.readReply({ modelUsage: {}, total_cost_usd: 0.5 }, false));
  }

  @TestMethod
  public keepsTheCacheReadAndCacheWrittenTokensApartFromTheNewOnes(): void {
    const usage = ClaudeUsageReader.readReply({ type: "result", modelUsage: {
      "claude-opus": { inputTokens: 10, cacheReadInputTokens: 5000, cacheCreationInputTokens: 300, outputTokens: 7 },
      "claude-haiku": { inputTokens: 2, cacheReadInputTokens: 40, cacheCreationInputTokens: 0, outputTokens: 3 }
    } }, false);
    const unread = ClaudeUsageReader.readReply({ type: "result", modelUsage: {
      "claude-opus": { inputTokens: 10, cacheCreationInputTokens: 300, outputTokens: 7 }
    } }, false);

    Assert.areEqual("5352 5040 300 null", [usage?.inputTokens, usage?.cacheReadTokens, usage?.cacheWriteTokens, usage?.reasoningTokens].map(String).join(" "));
    Assert.areEqual("null null 300 7", [unread?.inputTokens, unread?.cacheReadTokens, unread?.cacheWriteTokens, unread?.outputTokens].map(String).join(" "));
  }

  @TestMethod
  public leavesAFigureBlankWhenAnyModelLacksIt(): void {
    const usage = ClaudeUsageReader.readReply({ modelUsage: {
      "claude-opus": { inputTokens: 10, cacheCreationInputTokens: 1, outputTokens: 7 },
      "claude-haiku": { inputTokens: 2, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, outputTokens: "3" }
    } }, true);
    const costOnly = ClaudeUsageReader.readReply({ modelUsage: {}, total_cost_usd: 0.5 }, true);

    Assert.isNull(usage);
    Assert.areEqual("null null 0.5", `${costOnly?.inputTokens} ${costOnly?.outputTokens} ${costOnly?.costUsd}`);
    Assert.isNull(ClaudeUsageReader.readReply({ type: "result" }, true));
    Assert.isNull(ClaudeUsageReader.readReply(undefined, true));
  }

  @TestMethod
  public readsAHourCacheOnlyFromAResultThatWroteToIt(): void {
    const written = (hour: unknown, fiveMinutes: unknown): unknown => ({ type: "result", usage: { cache_creation: { ephemeral_1h_input_tokens: hour,
      ephemeral_5m_input_tokens: fiveMinutes } } });

    Assert.isTrue(ClaudeUsageReader.readsHourCache(written(1200, 0)));
    Assert.isFalse(ClaudeUsageReader.readsHourCache(written(0, 1200)));
    Assert.isFalse(ClaudeUsageReader.readsHourCache(written("1200", 0)));
    Assert.isFalse(ClaudeUsageReader.readsHourCache({ type: "result", usage: { cache_creation_input_tokens: 1200 } }));
    Assert.isFalse(ClaudeUsageReader.readsHourCache(null));
  }

  @TestMethod
  public readsTheContextAndItsCompactPointOnlyWhileAutoCompactIsOn(): void {
    const on = ClaudeUsageReader.readContext({ totalTokens: 50_000, maxTokens: 200_000, isAutoCompactEnabled: true, autoCompactThreshold: 180_000 });
    const off = ClaudeUsageReader.readContext({ totalTokens: 50_000, maxTokens: 200_000, isAutoCompactEnabled: false, autoCompactThreshold: 180_000 });

    Assert.areEqual("50000/200000/180000", `${on?.usedTokens}/${on?.windowTokens}/${on?.compactAtTokens}`);
    Assert.isNull(off?.compactAtTokens);
    Assert.isNull(ClaudeUsageReader.readContext({ totalTokens: 50_000 }));
    Assert.isNull(ClaudeUsageReader.readContext(undefined));
  }

  @TestMethod
  public holdsTheContextAndItsCompactPointWithinAChosenWindowSmallerThanClaudes(): void {
    const response = { totalTokens: 50_000, maxTokens: 400_000, isAutoCompactEnabled: true, autoCompactThreshold: 380_000 };
    const format = (t: ContextUsage | null): string => `${t?.usedTokens}/${t?.windowTokens}/${t?.compactAtTokens}`;

    Assert.areEqual("50000/200000/200000|50000/200000/180000|50000/150000/null|50000/400000/380000|50000/400000/380000|50000/400000/380000",
      [ClaudeUsageReader.readContext(response, 200_000), ClaudeUsageReader.readContext({ ...response, autoCompactThreshold: 180_000 }, 200_000),
        ClaudeUsageReader.readContext({ ...response, isAutoCompactEnabled: false }, 150_000), ClaudeUsageReader.readContext(response, 400_000),
        ClaudeUsageReader.readContext(response, 1_000_000), ClaudeUsageReader.readContext(response, null)].map(format).join("|"));
    Assert.isNull(ClaudeUsageReader.readContext({ totalTokens: 50_000 }, 200_000));
  }

  @TestMethod
  public readsTheContextWindowAResultReportsForTheModelAndNoneForZeroOrAnotherShape(): void {
    const result = { modelUsage: { "claude-sonnet-5": { contextWindow: 200_000 }, "claude-haiku-5": { contextWindow: 0 }, "claude-opus-5": { contextWindow: "1M" } } };

    Assert.areEqual("200000|null|null|null|null", ["claude-sonnet-5", "claude-haiku-5", "claude-opus-5", "claude-fable-5", null]
      .map(t => String(ClaudeUsageReader.readWindow(result, t))).join("|"));
    Assert.isNull(ClaudeUsageReader.readWindow(undefined, "claude-sonnet-5"));
  }

  @TestMethod
  public readsTheFourPlanWindowsUnderClaudesNames(): void {
    const windows = ClaudeUsageReader.readPlan({ rate_limits_available: true, rate_limits: {
      five_hour: { utilization: 12.5, resets_at: "2026-10-22T15:00:00+00:00" },
      seven_day: { utilization: 40, resets_at: null },
      seven_day_opus: null,
      seven_day_sonnet: { utilization: 3 },
      seven_day_oauth_apps: { utilization: 99, resets_at: "2026-10-23T00:00:00Z" }
    } });

    Assert.areEqual("FiveHour 12.5 2026-10-22T15:00:00.000Z,Weekly 40 null,WeeklySonnet 3 null",
      (windows ?? []).map(t => `${t.name} ${t.usedPercent} ${t.resetsAt}`).join(","));
  }

  @TestMethod
  public readsNoWindowsWhenClaudeHasNoneAndNothingFromAnotherShape(): void {
    Assert.areEqual(0, ClaudeUsageReader.readPlan({ rate_limits_available: false, rate_limits: { five_hour: { utilization: 1 } } })?.length);
    Assert.isNull(ClaudeUsageReader.readPlan({ rate_limits_available: true }));
    Assert.isNull(ClaudeUsageReader.readPlan(undefined));
  }
}
