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
import { SettingOption } from "@noldova/teamrun-shell-protocol";

@TestClass
export class SettingOptionTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"value\":\"Dark\",\"title\":\"Dark\"}";

    Assert.areEqual(text, JSON.stringify(new SettingOption("Dark", "Dark").toJson()));
    Assert.areEqual(text, JSON.stringify(SettingOption.fromJson(JSON.parse(text)).toJson()));
  }

  @TestMethod
  public namesTheBlankPart(): void {
    Assert.areEqual("value", Assert.throws(() => new SettingOption(" ", "Dark"), ArgumentException).parameterName);
    Assert.areEqual("title", Assert.throws(() => new SettingOption("Dark", ""), ArgumentException).parameterName);
  }

  @TestMethod
  @TestData("{\"value\":\"Dark\"}", "$.title")
  @TestData("{\"value\":\"Dark\",\"title\":\"Dark\",\"icon\":\"moon\"}", "$.icon")
  public rejectsAWireOptionThatIsNotOne(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => SettingOption.fromJson(JSON.parse(text)), JsonException).path);
  }
}
