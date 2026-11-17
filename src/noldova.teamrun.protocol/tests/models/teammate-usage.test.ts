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
import { ReplyUsage, TeammateUsage } from "@noldova/teamrun.protocol";

@TestClass
export class TeammateUsageTests {
  private static readonly usage: object = {
    teammateId: "tm-1", chatId: "c-1", messageId: "m-1", startedAt: "2026-10-22T01:00:00.000Z", endedAt: null,
    usage: { inputTokens: 1200, outputTokens: null, costUsd: null, context: { usedTokens: 10, windowTokens: 100, compactAtTokens: 90 },
      cacheReadTokens: null, cacheWriteTokens: null, reasoningTokens: null }
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const usage = TeammateUsage.fromJson(TeammateUsageTests.usage);

    Assert.areEqual(JSON.stringify(TeammateUsageTests.usage), JSON.stringify(usage.toJson()));
    Assert.areEqual(10, usage.usage.context?.usedTokens);
    Assert.isNull(usage.endedAt);
  }

  @TestMethod
  public refusesBlankIdsAndTimes(): void {
    const usage = new ReplyUsage(1, 2, null, null);

    Assert.throws(() => new TeammateUsage(" ", "c-1", "m-1", null, null, usage), ArgumentException);
    Assert.throws(() => new TeammateUsage("tm-1", " ", "m-1", null, null, usage), ArgumentException);
    Assert.throws(() => new TeammateUsage("tm-1", "c-1", " ", null, null, usage), ArgumentException);
    Assert.throws(() => new TeammateUsage("tm-1", "c-1", "m-1", " ", null, usage), ArgumentException);
    Assert.throws(() => new TeammateUsage("tm-1", "c-1", "m-1", null, " ", usage), ArgumentException);
    Assert.throws(() => TeammateUsage.fromJson({ ...TeammateUsageTests.usage, usage: null }), JsonException);
  }
}
