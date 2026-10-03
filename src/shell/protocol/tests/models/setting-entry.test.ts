/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { QualifiedName, SettingEntry } from "@noldova/teamrun-shell-protocol";

@TestClass
export class SettingEntryTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"name\":\"shell.mode\",\"value\":\"System\",\"isSet\":false}";
    const entry = SettingEntry.fromJson(JSON.parse(text));

    Assert.areEqual(text, JSON.stringify(new SettingEntry(QualifiedName.parse("shell.mode"), "System", false).toJson()));
    Assert.areEqual(text, JSON.stringify(entry.toJson()));
    Assert.areEqual("shell.mode,System,false", [entry.name.text, entry.value, entry.isSet].join(","));
  }

  @TestMethod
  @TestData("{\"name\":\"shell.mode\",\"value\":\"Dark\"}", "$.isSet")
  @TestData("{\"name\":\"shell.mode\",\"value\":\"Dark\",\"isSet\":true,\"scope\":null}", "$.scope")
  public rejectsAWireEntryThatIsNotOne(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => SettingEntry.fromJson(JSON.parse(text)), JsonException).path);
  }
}
