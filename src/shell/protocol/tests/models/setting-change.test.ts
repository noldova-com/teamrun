/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { QualifiedName, SettingChange, SettingKey } from "@noldova/teamrun-shell-protocol";

@TestClass
export class SettingChangeTests {
  @TestMethod
  public pinsItsWireFormForASetAndAReset(): void {
    const set = "{\"name\":\"shell.doNotDisturb\",\"device\":\"d1\",\"value\":true,\"isSet\":true}";
    const reset = "{\"name\":\"shell.mode\",\"value\":\"System\",\"isSet\":false}";
    const change = SettingChange.fromJson(JSON.parse(set));

    Assert.areEqual(set, JSON.stringify(new SettingChange(new SettingKey(QualifiedName.parse("shell.doNotDisturb"), null, "d1"), true, true).toJson()));
    Assert.areEqual(set, JSON.stringify(change.toJson()));
    Assert.areEqual(reset, JSON.stringify(SettingChange.fromJson(JSON.parse(reset)).toJson()));
    Assert.areEqual("shell.doNotDisturb,true,true", [change.key.name.text, change.value, change.isSet].join(","));
  }

  @TestMethod
  @TestData("{\"name\":\"shell.mode\",\"isSet\":true}", "$.value")
  @TestData("{\"name\":\"shell.mode\",\"value\":\"Dark\"}", "$.isSet")
  @TestData("{\"name\":\"shell.mode\",\"value\":\"Dark\",\"isSet\":\"yes\"}", "$.isSet")
  @TestData("{\"name\":\"mode\",\"value\":\"Dark\",\"isSet\":true}", "$.name")
  @TestData("{\"name\":\"shell.mode\",\"value\":\"Dark\",\"isSet\":true,\"extra\":1}", "$.extra")
  public rejectsAWireChangeThatIsNotOne(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => SettingChange.fromJson(JSON.parse(text)), JsonException).path);
  }
}
