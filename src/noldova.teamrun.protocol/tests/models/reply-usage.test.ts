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
import { ContextUsage, ReplyUsage } from "@noldova/teamrun.protocol";

@TestClass
export class ReplyUsageTests {
  @TestMethod
  public mergesNewerReplyFiguresOverOlderOnes(): void {
    const context = new ContextUsage(10, 100, null);
    const older = new ReplyUsage(5, 7, 0.25, context);
    const merged = older.merge(new ReplyUsage(null, 9, null, null));
    const value = { inputTokens: 1200, outputTokens: 340, costUsd: 0.0125, context: { usedTokens: 10, windowTokens: 100, compactAtTokens: null }, cacheReadTokens: null, cacheWriteTokens: null, reasoningTokens: null };

    Assert.areEqual(JSON.stringify({ inputTokens: 5, outputTokens: 9, costUsd: 0.25, context: context.toJson(), cacheReadTokens: null, cacheWriteTokens: null, reasoningTokens: null }), JSON.stringify(merged.toJson()));
    Assert.areEqual(JSON.stringify(value), JSON.stringify(ReplyUsage.fromJson(value).toJson()));
    Assert.areEqual(JSON.stringify({ inputTokens: null, outputTokens: null, costUsd: null, context: null, cacheReadTokens: null, cacheWriteTokens: null, reasoningTokens: null }),
      JSON.stringify(ReplyUsage.fromJson({ inputTokens: null, outputTokens: null, costUsd: null, context: null }).toJson()));
    Assert.throws(() => new ReplyUsage(-1, null, null, null), ArgumentException);
    Assert.throws(() => new ReplyUsage(null, 1.5, null, null), ArgumentException);
    Assert.throws(() => new ReplyUsage(null, null, -0.5, null), ArgumentException);
    Assert.throws(() => new ReplyUsage(null, null, Number.NaN, null), ArgumentException);
  }

  @TestMethod
  public keepsTheCacheAndReasoningTokensAndReadsAStoredUsageWithoutThem(): void {
    const older = new ReplyUsage(1200, 340, null, null, 1000, 150, 120);
    const merged = older.merge(new ReplyUsage(1300, null, null, null, 1100, null, 130));
    const value = { inputTokens: 1200, outputTokens: 340, costUsd: null, context: null, cacheReadTokens: 1000, cacheWriteTokens: 150, reasoningTokens: 120 };

    Assert.areEqual("1300 340 1100 150 130", [merged.inputTokens, merged.outputTokens, merged.cacheReadTokens, merged.cacheWriteTokens, merged.reasoningTokens].join(" "));
    Assert.areEqual(JSON.stringify(value), JSON.stringify(ReplyUsage.fromJson(value).toJson()));
    const stored = ReplyUsage.fromJson({ inputTokens: 5, outputTokens: 6, costUsd: null, context: null });
    Assert.areEqual("null null null", [stored.cacheReadTokens, stored.cacheWriteTokens, stored.reasoningTokens].map(String).join(" "));
    Assert.throws(() => new ReplyUsage(null, null, null, null, -1), ArgumentException);
    Assert.throws(() => new ReplyUsage(null, null, null, null, null, 1.5), ArgumentException);
    Assert.throws(() => new ReplyUsage(null, null, null, null, null, null, -2), ArgumentException);
    Assert.throws(() => ReplyUsage.fromJson({ ...value, reasoningTokens: "many" }), JsonException);
  }
}
