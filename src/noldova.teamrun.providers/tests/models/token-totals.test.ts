/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TokenTotals } from "@noldova/teamrun.providers";

@TestClass
export class TokenTotalsTests {
  @TestMethod
  public isAheadOnlyWhenNeitherCountFellAndOneGrew(): void {
    const before = new TokenTotals(100, 20);

    Assert.areEqual("0 0", `${TokenTotals.zero.inputTokens} ${TokenTotals.zero.outputTokens}`);
    Assert.isTrue(new TokenTotals(150, 20).isAhead(before));
    Assert.isTrue(new TokenTotals(100, 25).isAhead(before));
    Assert.isFalse(new TokenTotals(100, 20).isAhead(before));
    Assert.isFalse(new TokenTotals(90, 40).isAhead(before));
    Assert.isFalse(new TokenTotals(150, 10).isAhead(before));
  }

  @TestMethod
  public measuresEachCountsGrowthAndLeavesBlankACacheOrReasoningCountUnknownOrFallen(): void {
    const since = new TokenTotals(1500, 260, 1200, 40, 90).since(new TokenTotals(1000, 200, 800, 50, null));

    Assert.areEqual("500 60 400 null null", [since.inputTokens, since.outputTokens, since.cacheReadTokens, since.cacheWriteTokens, since.reasoningTokens].map(String).join(" "));
    Assert.areEqual("0 0 0", [TokenTotals.zero.cacheReadTokens, TokenTotals.zero.cacheWriteTokens, TokenTotals.zero.reasoningTokens].join(" "));
    Assert.areEqual("null", String(new TokenTotals(1, 1).since(TokenTotals.zero).reasoningTokens));
  }
}
