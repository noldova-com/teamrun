/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PlanWindowName } from "@noldova/teamrun.protocol";
import { UsageValues } from "@noldova/teamrun.providers";

@TestClass
export class UsageValuesTests {
  @TestMethod
  public readsAFieldAlongAPathAndNothingThroughAnotherShape(): void {
    Assert.areEqual(3, UsageValues.fieldOf({ a: { b: 3 } }, "a", "b"));
    Assert.areEqual("{\"b\":3}", JSON.stringify(UsageValues.objectOf({ b: 3 })));
    Assert.isUndefined(UsageValues.fieldOf({ a: [1] }, "a", "b"));
    Assert.isUndefined(UsageValues.fieldOf("text", "a"));
    Assert.isUndefined(UsageValues.fieldOf(undefined, "a"));
    Assert.isNull(UsageValues.objectOf(null));
    Assert.isNull(UsageValues.objectOf([]));
  }

  @TestMethod
  public keepsOnlyWholeCountsAndFiniteAmounts(): void {
    Assert.areEqual(0, UsageValues.count(0));
    Assert.areEqual(1200, UsageValues.count(1200));
    Assert.isNull(UsageValues.count(1.5));
    Assert.isNull(UsageValues.count(-1));
    Assert.isNull(UsageValues.count("3"));
    Assert.isNull(UsageValues.count(undefined));
    Assert.areEqual(0.25, UsageValues.amount(0.25));
    Assert.isNull(UsageValues.amount(-0.1));
    Assert.isNull(UsageValues.amount(Number.POSITIVE_INFINITY));
    Assert.isNull(UsageValues.amount(null));
  }

  @TestMethod
  public readsTimesAsUtcOrNothing(): void {
    Assert.areEqual("2026-10-22T08:00:00.000Z", UsageValues.time("2026-10-22T10:00:00+02:00"));
    Assert.isNull(UsageValues.time("soon"));
    Assert.isNull(UsageValues.time("  "));
    Assert.isNull(UsageValues.time(5));
    Assert.areEqual("1970-01-01T00:00:01.000Z", UsageValues.timeFromMilliseconds(1000));
    Assert.isNull(UsageValues.timeFromMilliseconds(-1));
    Assert.isNull(UsageValues.timeFromMilliseconds("1000"));
  }

  @TestMethod
  public buildsAContextOnlyFromAUsedCountAndAWindow(): void {
    const full = UsageValues.context(20_000, 200_000, 170_000);
    const noCompact = UsageValues.context(20_000, 200_000);

    Assert.areEqual("20000/200000/170000", `${full?.usedTokens}/${full?.windowTokens}/${full?.compactAtTokens}`);
    Assert.isNull(noCompact?.compactAtTokens);
    Assert.isNull(UsageValues.context(20_000, 200_000, 0)?.compactAtTokens);
    Assert.isNull(UsageValues.context(20_000, 200_000, "170000")?.compactAtTokens);
    Assert.isNull(UsageValues.context(null, 200_000));
    Assert.isNull(UsageValues.context(20_000, 0));
    Assert.isNull(UsageValues.context(20_000, "200000"));
  }

  @TestMethod
  public namesAWindowOnlyWithANameAndAShare(): void {
    const window = UsageValues.window(PlanWindowName.Weekly, 42.5, "2026-10-27T00:00:00.000Z");

    Assert.areEqual("Weekly 42.5 2026-10-27T00:00:00.000Z", `${window?.name} ${window?.usedPercent} ${window?.resetsAt}`);
    Assert.isNull(UsageValues.window(PlanWindowName.Weekly, 0, null)?.resetsAt);
    Assert.isNull(UsageValues.window(null, 1, null));
    Assert.isNull(UsageValues.window(PlanWindowName.Weekly, "1", null));
    Assert.isNull(UsageValues.window(PlanWindowName.Weekly, -1, null));
  }
}
