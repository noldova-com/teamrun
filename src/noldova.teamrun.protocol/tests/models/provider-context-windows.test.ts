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
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { ProviderContextWindows } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderContextWindowsTests {
  private static readonly json: object = { presets: [200_000, 400_000, 1_000_000], minimum: 100_000, maximum: 1_000_000, reported: true };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ProviderContextWindows.fromJson(ProviderContextWindowsTests.json);
    const unreported = ProviderContextWindows.fromJson(new ProviderContextWindows([], 100_000, 1_000_000, false).toJson());

    Assert.areEqual("200000,400000,1000000|100000|1000000|true", [value.presets.join(","), value.minimum, value.maximum, value.reported].join("|"));
    Assert.areEqual(JSON.stringify(ProviderContextWindowsTests.json), JSON.stringify(value.toJson()));
    Assert.isFalse(unreported.reported);
  }

  @TestMethod
  public allowsEachSizeFromItsMinimumToItsMaximumAndNoneBeyond(): void {
    const windows = new ProviderContextWindows([200_000], 100_000, 200_000, true);

    Assert.areEqual("false true true true false false false",
      [99_999, 100_000, 150_000, 200_000, 200_001, 150_000.5, Number.NaN].map(t => String(windows.allows(t))).join(" "));
  }

  @TestMethod
  @TestData(0, 100_000, "")
  @TestData(100_000, 99_999, "")
  @TestData(100_000, 1_000_000, "50000")
  @TestData(100_000, 1_000_000, "1000001")
  @TestData(100_000, 1_000_000, "200000,200000")
  @TestData(100_000.5, 1_000_000, "")
  public refusesBoundsAndPresetsThatDoNotHoldTogether(minimum: number, maximum: number, presets: string): void {
    const sizes = presets.length === 0 ? [] : presets.split(",").map(Number);

    Assert.areEqual("contextWindows", Assert.throws(() => new ProviderContextWindows(sizes, minimum, maximum, true), ArgumentException).parameterName);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    Assert.areEqual("$.minimum", Assert.throws(() => ProviderContextWindows.fromJson({ presets: [], minimum: "1", maximum: 2 }), JsonException).path);
    Assert.areEqual("$.presets", Assert.throws(() => ProviderContextWindows.fromJson({ minimum: 1, maximum: 2 }), JsonException).path);
    Assert.areEqual("$.presets", Assert.throws(() => ProviderContextWindows.fromJson({ presets: 200_000, minimum: 1, maximum: 2 }), JsonException).path);
    Assert.areEqual("$.presets", Assert.throws(() => ProviderContextWindows.fromJson({ presets: [200_000, "400K"], minimum: 1, maximum: 2 }), JsonException).path);
    Assert.areEqual("$.reported", Assert.throws(() => ProviderContextWindows.fromJson({ presets: [], minimum: 1, maximum: 2 }), JsonException).path);
    Assert.areEqual("$.reported", Assert.throws(() => ProviderContextWindows.fromJson({ presets: [], minimum: 1, maximum: 2, reported: "true" }), JsonException).path);
  }

  @TestMethod
  public namesSizesInWholeMillionsOrInThousandsToATenth(): void {
    Assert.areEqual("1M 2M 200K 400K 100K 150.5K 999.9K 1500K",
      [1_000_000, 2_000_000, 200_000, 400_000, 100_000, 150_500, 999_949, 1_500_000].map(t => ProviderContextWindows.nameOf(t)).join(" "));
  }

  @TestMethod
  public readsATypedSizeInTokensOrWithKOrMAfterIt(): void {
    Assert.areEqual("150000 300000 300000 1500000 1000000 150500 1",
      ["150000", " 300K ", "300 k", "1.5M", "1m", "150.5K", "0.001K"].map(t => String(ProviderContextWindows.parse(t))).join(" "));
    Assert.areEqual("null null null null null null null null null",
      ["", "K", "300KB", "-300K", "300  K", "1e6", "12345678", "0.0001K", "0K"].map(t => String(ProviderContextWindows.parse(t))).join(" "));
  }
}
