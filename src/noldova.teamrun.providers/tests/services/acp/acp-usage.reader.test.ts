/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { ReplyUsage } from "@noldova/teamrun.protocol";
import { AcpUsageReader } from "@noldova/teamrun.providers";

@TestClass
export class AcpUsageReaderTests {
  @TestMethod
  public readsTheTokensAnAnswersUsageNames(): void {
    const reader = new AcpUsageReader();

    const usage = reader.readReply({ stopReason: "end_turn",
      usage: { inputTokens: 22535, outputTokens: 4, totalTokens: 22539, thoughtTokens: 0, cachedReadTokens: 0, cachedWriteTokens: 22531 } });

    Assert.areEqual("22535 4 null null 0 22531 0", AcpUsageReaderTests.textOf(usage));
  }

  @TestMethod
  public countsTheCacheInTheInputOnlyWhenTheTotalIsTheInputAndOutputAlone(): void {
    const reader = new AcpUsageReader();
    const usage = (fields: JsonObject): string => AcpUsageReaderTests.textOf(reader.readReply({ stopReason: "end_turn", usage: fields }));

    Assert.areEqual("100 50 null null 30 10 20", usage({ inputTokens: 100, outputTokens: 50, totalTokens: 150, thoughtTokens: 20, cachedReadTokens: 30,
      cachedWriteTokens: 10 }));
    Assert.areEqual("140 50 null null 30 10 20", usage({ inputTokens: 100, outputTokens: 50, totalTokens: 180, thoughtTokens: 20, cachedReadTokens: 30,
      cachedWriteTokens: 10 }));
    Assert.areEqual("140 50 null null 30 10 null", usage({ inputTokens: 100, outputTokens: 50, cachedReadTokens: 30, cachedWriteTokens: 10 }));
    Assert.areEqual("130 null null null 30 null null", usage({ inputTokens: 100, totalTokens: 130, cachedReadTokens: 30 }));
    Assert.areEqual("100 null null null 30 null null", usage({ inputTokens: 100, totalTokens: 100, cachedReadTokens: 30 }));
  }

  @TestMethod
  public readsWhatAnAnswersUsageNamesAndSkipsAnyCountThatIsNotOne(): void {
    const reader = new AcpUsageReader();

    const partial = reader.readReply({ stopReason: "end_turn", usage: { outputTokens: 7, totalTokens: 7 } });
    const unreadable = reader.readReply({ stopReason: "end_turn", usage: { inputTokens: 12, outputTokens: 3, cachedReadTokens: -1, cachedWriteTokens: 1.5,
      thoughtTokens: "2" } });

    Assert.areEqual("null 7 null null null null null", AcpUsageReaderTests.textOf(partial));
    Assert.areEqual("12 3 null null null null null", AcpUsageReaderTests.textOf(unreadable));
  }

  @TestMethod
  public readsNoUsageFromAnAnswerThatNamesNeitherInputNorOutputTokens(): void {
    const reader = new AcpUsageReader();

    Assert.isNull(reader.readReply({ stopReason: "end_turn" }));
    Assert.isNull(reader.readReply({ stopReason: "end_turn", usage: { totalTokens: 10, thoughtTokens: 2 } }));
    Assert.isNull(reader.readReply({ stopReason: "end_turn", usage: "none" }));
    Assert.isNull(reader.readReply(null));
    Assert.isNull(reader.readContext({}));
    Assert.isNull(reader.readPlan({}));
    Assert.areEqual(0, reader.contextMethods.length + reader.planMethods.length);
  }

  private static textOf(usage: ReplyUsage | null): string {
    return Object.isNull(usage) ? "none" : [usage.inputTokens, usage.outputTokens, usage.costUsd, usage.context, usage.cacheReadTokens, usage.cacheWriteTokens,
      usage.reasoningTokens].map(String).join(" ");
  }
}
