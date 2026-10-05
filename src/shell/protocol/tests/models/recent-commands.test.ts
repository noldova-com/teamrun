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
import { RecentCommands } from "@noldova/teamrun-shell-protocol";

@TestClass
export class RecentCommandsTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const json = { ids: ["shell.openSettings", "clock.show"], device: "laptop" };
    const recent = RecentCommands.fromJson(json);

    Assert.areEqual("laptop|shell.openSettings,clock.show", `${String(recent.device)}|${recent.ids.join(",")}`);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(recent.toJson()));
    Assert.areEqual(JSON.stringify({ ids: ["clock.show"] }), JSON.stringify(new RecentCommands(["clock.show"]).toJson()));
    Assert.isNull(RecentCommands.fromJson({ ids: [] }).device);
  }

  @TestMethod
  public copiesTheIds(): void {
    const ids = ["clock.show"];
    const recent = new RecentCommands(ids);
    ids.push("shell.openSettings");

    Assert.areEqual("clock.show", recent.ids.join(","));
  }

  @TestMethod
  public refusesABlankDeviceABlankOrRepeatedIdAndMissingAndUnknownFields(): void {
    Assert.areEqual("device", Assert.throws(() => new RecentCommands([], " "), ArgumentException).parameterName);
    Assert.areEqual("ids", Assert.throws(() => new RecentCommands([""]), ArgumentException).parameterName);
    Assert.areEqual("ids", Assert.throws(() => new RecentCommands(["clock.show", "clock.show"]), ArgumentException).parameterName);
    Assert.areEqual("$.ids", Assert.throws(() => RecentCommands.fromJson({ ids: ["a", "a"] }), JsonException).path);
    Assert.areEqual("$.ids", Assert.throws(() => RecentCommands.fromJson({ device: "laptop" }), JsonException).path);
    Assert.areEqual("$.extra", Assert.throws(() => RecentCommands.fromJson({ ids: [], extra: 1 }), JsonException).path);
  }
}
