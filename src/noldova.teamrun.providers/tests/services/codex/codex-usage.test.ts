/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { ReplyUsage } from "@noldova/teamrun.protocol";
import { CodexRateLimits, CodexUsage, TokenTotals } from "@noldova/teamrun.providers";

import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";

@TestClass
export class CodexUsageTests {
  @TestMethod
  public async reportsTheTurnsTokensAsTheThreadTotalLessItsTotalBefore(): Promise<void> {
    const listener = new RecordingTurnListener();
    const usage = new CodexUsage("t1", listener, new TokenTotals(1000, 200), new CodexRateLimits());

    await usage.handleNotificationAsync("thread/tokenUsage/updated", CodexUsageTests.tokens("t1", 1500, 260, 30_000, 200_000));
    await usage.handleNotificationAsync("thread/tokenUsage/updated", CodexUsageTests.tokens("t1", 1500, 260, 30_000, 200_000));
    await usage.handleNotificationAsync("thread/tokenUsage/updated", CodexUsageTests.tokens("t2", 9000, 900, 90_000, 200_000));

    Assert.areEqual("500 60 null 30000/200000,500 60 null 30000/200000", listener.usages.map(CodexUsageTests.format).join(","));
    Assert.areEqual("1500 260", `${usage.totals?.inputTokens} ${usage.totals?.outputTokens}`);
  }

  @TestMethod
  public async reportsTheTurnsCachedInputAndReasoningOutputAsTheirGrowth(): Promise<void> {
    const listener = new RecordingTurnListener();
    const usage = new CodexUsage("t1", listener, TokenTotals.zero, new CodexRateLimits());

    await usage.handleNotificationAsync("thread/tokenUsage/updated", JsonReader.fromValue({ threadId: "t1", tokenUsage: {
      total: { inputTokens: 260_000, cachedInputTokens: 240_000, cacheWriteInputTokens: 0, outputTokens: 1500, reasoningOutputTokens: 900, totalTokens: 261_500 },
      last: { inputTokens: 30_000, outputTokens: 0, totalTokens: 30_000 }, modelContextWindow: 200_000
    } }));

    Assert.areEqual("260000 1500 240000 0 900", listener.usages.map(t => [t.inputTokens, t.outputTokens, t.cacheReadTokens, t.cacheWriteTokens, t.reasoningTokens].join(" ")).join(","));
    Assert.areEqual("240000 0 900", `${usage.totals?.cacheReadTokens} ${usage.totals?.cacheWriteTokens} ${usage.totals?.reasoningTokens}`);
  }

  @TestMethod
  public async startsAFreshThreadFromZero(): Promise<void> {
    const listener = new RecordingTurnListener();
    const usage = new CodexUsage("t1", listener, TokenTotals.zero, new CodexRateLimits());

    await usage.handleNotificationAsync("thread/tokenUsage/updated", CodexUsageTests.tokens("t1", 800, 40, 12_000, 200_000));

    Assert.areEqual("800 40 null 12000/200000", listener.usages.map(CodexUsageTests.format).join(","));
  }

  @TestMethod
  public async leavesTheTokensBlankWithoutATotalBeforeOrWhenTheTotalFell(): Promise<void> {
    const resumed = new RecordingTurnListener();
    const fell = new RecordingTurnListener();
    const unknown = new CodexUsage("t1", resumed, null, new CodexRateLimits());
    const behind = new CodexUsage("t1", fell, new TokenTotals(5000, 500), new CodexRateLimits());

    await unknown.handleNotificationAsync("thread/tokenUsage/updated", CodexUsageTests.tokens("t1", 800, 40, 12_000, 200_000));
    await behind.handleNotificationAsync("thread/tokenUsage/updated", CodexUsageTests.tokens("t1", 800, 40, 12_000, 200_000));

    Assert.areEqual("null null null 12000/200000", resumed.usages.map(CodexUsageTests.format).join(","));
    Assert.areEqual("null null null 12000/200000", fell.usages.map(CodexUsageTests.format).join(","));
    Assert.areEqual("800 40", `${unknown.totals?.inputTokens} ${unknown.totals?.outputTokens}`);
  }

  @TestMethod
  public async reportsNothingWhenNeitherTokensNorAContextCanBeRead(): Promise<void> {
    const listener = new RecordingTurnListener();
    const usage = new CodexUsage("t1", listener, new TokenTotals(10, 1), new CodexRateLimits());

    await usage.handleNotificationAsync("thread/tokenUsage/updated", JsonReader.fromValue({ threadId: "t1", tokenUsage: { total: { inputTokens: "many" }, last: {} } }));
    await usage.handleNotificationAsync("item/completed", JsonReader.fromValue({ threadId: "t1" }));

    Assert.areEqual(0, listener.usages.length);
    Assert.areEqual("10 1", `${usage.totals?.inputTokens} ${usage.totals?.outputTokens}`);
  }

  @TestMethod
  public async reportsTheProvidersRateLimitsAsPlanUse(): Promise<void> {
    const listener = new RecordingTurnListener();
    const usage = new CodexUsage("t1", listener, TokenTotals.zero, new CodexRateLimits());

    await usage.handleNotificationAsync("account/rateLimits/updated", JsonReader.fromValue({ rateLimits: { limitId: "codex", primary: { usedPercent: 12, windowDurationMins: 300 } } }));
    await usage.handleNotificationAsync("account/rateLimits/updated", JsonReader.fromValue({ rateLimits: { limitId: "codex_other_model", primary: { usedPercent: 90, windowDurationMins: 300 } } }));

    Assert.areEqual("FiveHour 12", listener.planUsages.map(t => t.map(w => `${w.name} ${w.usedPercent}`).join(";")).join(","));
  }

  private static tokens(threadId: string, input: number, output: number, last: number, window: number): JsonReader {
    return JsonReader.fromValue({ threadId, turnId: "turn-1", tokenUsage: {
      total: { inputTokens: input, outputTokens: output, totalTokens: input + output },
      last: { inputTokens: last, outputTokens: 0, totalTokens: last },
      modelContextWindow: window
    } });
  }

  private static format(usage: ReplyUsage): string {
    return `${usage.inputTokens} ${usage.outputTokens} ${usage.costUsd} ${usage.context?.usedTokens}/${usage.context?.windowTokens}`;
  }
}
