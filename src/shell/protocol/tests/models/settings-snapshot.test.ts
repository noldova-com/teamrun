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
import { QualifiedName, SettingDefinition, SettingEntry, SettingLocality, SettingType, SettingsSnapshot } from "@noldova/teamrun-shell-protocol";

@TestClass
export class SettingsSnapshotTests {
  private static readonly MODE: SettingDefinition = new SettingDefinition(
    QualifiedName.parse("shell.mode"), "Mode", "Light or dark.", SettingType.boolean(), false, SettingLocality.Shared, [], "Appearance", "Theme");

  @TestMethod
  public pinsItsWireForm(): void {
    const snapshot = new SettingsSnapshot([SettingsSnapshotTests.MODE], [new SettingEntry(SettingsSnapshotTests.MODE.name, true, true)]);
    const text = JSON.stringify(snapshot.toJson());
    const read = SettingsSnapshot.fromJson(JSON.parse(text));

    Assert.areEqual(text, JSON.stringify(read.toJson()));
    Assert.areEqual("shell.mode,shell.mode", [read.definitions[0]?.name.text, read.entries[0]?.name.text].join(","));
  }

  @TestMethod
  public refusesRepeatedNamesAndEntriesWithoutADefinition(): void {
    const entry = new SettingEntry(SettingsSnapshotTests.MODE.name, true, true);

    Assert.throws(() => new SettingsSnapshot([SettingsSnapshotTests.MODE, SettingsSnapshotTests.MODE], []), ArgumentException);
    Assert.throws(() => new SettingsSnapshot([SettingsSnapshotTests.MODE], [entry, entry]), ArgumentException);
    Assert.throws(() => new SettingsSnapshot([], [entry]), ArgumentException);
  }

  @TestMethod
  @TestData("{\"definitions\":[],\"entries\":[{\"name\":\"shell.mode\",\"value\":true,\"isSet\":true}]}", "$.entries")
  @TestData("{\"definitions\":[]}", "$.entries")
  @TestData("{\"definitions\":[],\"entries\":[],\"device\":\"d1\"}", "$.device")
  public rejectsAWireSnapshotThatIsNotOne(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => SettingsSnapshot.fromJson(JSON.parse(text)), JsonException).path);
  }
}
