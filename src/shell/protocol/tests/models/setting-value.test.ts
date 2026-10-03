/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { QualifiedName, SettingKey, SettingValue } from "@noldova/teamrun-shell-protocol";

@TestClass
export class SettingValueTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"name\":\"shell.doNotDisturb\",\"device\":\"d1\",\"value\":true}";
    const value = SettingValue.fromJson(JSON.parse(text));

    Assert.areEqual(text, JSON.stringify(new SettingValue(new SettingKey(QualifiedName.parse("shell.doNotDisturb"), null, "d1"), true).toJson()));
    Assert.areEqual(text, JSON.stringify(value.toJson()));
    Assert.areEqual("shell.doNotDisturb,true", [value.key.name.text, value.value].join(","));
  }

  @TestMethod
  @TestData("{\"name\":\"shell.mode\"}", "$.value")
  @TestData("{\"name\":\"mode\",\"value\":\"Dark\"}", "$.name")
  @TestData("{\"name\":\"shell.mode\",\"value\":\"Dark\",\"extra\":1}", "$.extra")
  public rejectsAWireValueThatIsNotOne(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => SettingValue.fromJson(JSON.parse(text)), JsonException).path);
  }
}
