/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { SettingsQuery } from "@noldova/teamrun-shell-protocol";

@TestClass
export class SettingsQueryTests {
  @TestMethod
  public pinsItsWireFormWithAndWithoutADevice(): void {
    Assert.areEqual("{\"device\":\"d1\"}", JSON.stringify(new SettingsQuery("d1").toJson()));
    Assert.areEqual("{}", JSON.stringify(new SettingsQuery(null).toJson()));
    Assert.areEqual("d1", SettingsQuery.fromJson({ device: "d1" }).device);
    Assert.isNull(SettingsQuery.fromJson({}).device);
  }

  @TestMethod
  public refusesABlankDevice(): void {
    Assert.areEqual("device", Assert.throws(() => new SettingsQuery(""), ArgumentException).parameterName);
  }

  @TestMethod
  @TestData("{\"device\":\" \"}", "$.device")
  @TestData("{\"window\":\"main\"}", "$.window")
  public rejectsAWireQueryThatIsNotOne(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => SettingsQuery.fromJson(JSON.parse(text)), JsonException).path);
  }
}
