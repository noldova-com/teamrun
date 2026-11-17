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
import { ContextUsage } from "@noldova/teamrun.protocol";

@TestClass
export class ContextUsageTests {
  @TestMethod
  public roundTripsThroughJson(): void {
    for (const value of [{ usedTokens: 86000, windowTokens: 200000, compactAtTokens: 167000 }, { usedTokens: 0, windowTokens: 1, compactAtTokens: null }])
      Assert.areEqual(JSON.stringify(value), JSON.stringify(ContextUsage.fromJson(value).toJson()));
  }

  @TestMethod
  public refusesFiguresOutOfRange(): void {
    Assert.throws(() => new ContextUsage(-1, 10, null), ArgumentException);
    Assert.throws(() => new ContextUsage(1.5, 10, null), ArgumentException);
    Assert.throws(() => new ContextUsage(1, 0, null), ArgumentException);
    Assert.throws(() => new ContextUsage(1, 10, 0), ArgumentException);
    Assert.throws(() => new ContextUsage(1, 10, 2.5), ArgumentException);
    Assert.throws(() => ContextUsage.fromJson({ usedTokens: 1, windowTokens: 10 }), JsonException);
  }
}
