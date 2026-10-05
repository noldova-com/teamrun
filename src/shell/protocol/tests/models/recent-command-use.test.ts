/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { RecentCommandUse } from "@noldova/teamrun-shell-protocol";

@TestClass
export class RecentCommandUseTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const json = { device: "laptop", id: "clock.show" };
    const use = RecentCommandUse.fromJson(json);

    Assert.areEqual("laptop|clock.show", `${use.device}|${use.id}`);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(new RecentCommandUse("laptop", "clock.show").toJson()));
  }

  @TestMethod
  public refusesABlankDeviceOrIdAndMissingAndUnknownFields(): void {
    Assert.areEqual("device", Assert.throws(() => new RecentCommandUse("", "clock.show"), ArgumentException).parameterName);
    Assert.areEqual("id", Assert.throws(() => new RecentCommandUse("laptop", " "), ArgumentException).parameterName);
    Assert.areEqual("$.id", Assert.throws(() => RecentCommandUse.fromJson({ device: "laptop" }), JsonException).path);
    Assert.areEqual("$.extra", Assert.throws(() => RecentCommandUse.fromJson({ device: "laptop", id: "clock.show", extra: 1 }), JsonException).path);
  }
}
