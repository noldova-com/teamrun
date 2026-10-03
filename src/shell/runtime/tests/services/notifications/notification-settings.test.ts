/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { QualifiedName, SettingDefinition, SettingKey, SettingLocality, SettingType, SettingValue } from "@noldova/teamrun-shell-protocol";
import { NotificationSettings } from "@noldova/teamrun-shell-runtime";

import { SettingsFixture } from "../../fixtures/settings.fixture.js";

@TestClass
export class NotificationSettingsTests {
  private static readonly QUIET: QualifiedName = QualifiedName.parse("shell.doNotDisturb");
  private static readonly MUTED: QualifiedName = QualifiedName.parse("shell.mutedModules");
  private static readonly QUIET_DEFINITION: SettingDefinition = new SettingDefinition(NotificationSettingsTests.QUIET, "Do not disturb", "Holds back toasts.",
    SettingType.boolean(), false, SettingLocality.Device, [], "Notifications", "Notifications");
  private static readonly DEFINITIONS: readonly SettingDefinition[] = [
    NotificationSettingsTests.QUIET_DEFINITION,
    new SettingDefinition(NotificationSettingsTests.MUTED, "Notifications from modules", "Mutes modules.", SettingType.modules(), [], SettingLocality.Shared, [],
      "Notifications", "Notifications")
  ];

  @TestMethod
  public readsTheQuietDevicesInOrderAndTheMutedModulesFromTheSettings(): Promise<void> {
    return NotificationSettingsTests.withSettingsAsync(NotificationSettingsTests.DEFINITIONS, (fixture, settings) => {
      Assert.areEqual("||false", [settings.quietDevices.join(","), settings.mutedModules.join(","), String(settings.isQuiet("d1"))].join("|"));

      fixture.service.write(new SettingValue(new SettingKey(NotificationSettingsTests.QUIET, null, "d2"), true));
      fixture.service.write(new SettingValue(new SettingKey(NotificationSettingsTests.QUIET, null, "d3"), false));
      fixture.service.write(new SettingValue(new SettingKey(NotificationSettingsTests.QUIET, null, "d1"), true));
      fixture.service.write(new SettingValue(new SettingKey(NotificationSettingsTests.MUTED), ["tasks", "notes"]));

      Assert.areEqual("d1,d2|tasks,notes|true,false", [
        settings.quietDevices.join(","),
        settings.mutedModules.join(","),
        ["d1", "d3"].map(t => String(settings.isQuiet(t))).join(",")
      ].join("|"));
    });
  }

  @TestMethod
  public namesOnlyTheTwoNotificationSettings(): void {
    const settings = new NotificationSettings(null);

    Assert.areEqual("true,true,false", ["shell.doNotDisturb", "shell.mutedModules", "shell.mode"].map(t => String(settings.isNotificationSetting(t))).join(","));
  }

  @TestMethod
  public treatsMissingSettingsAsNoQuietDeviceAndNoMutedModule(): void {
    const settings = new NotificationSettings(null);

    Assert.areEqual("||false", [settings.quietDevices.join(","), settings.mutedModules.join(","), String(settings.isQuiet("d1"))].join("|"));
  }

  @TestMethod
  public mutesNoModuleWhenTheSettingHoldsNoList(): Promise<void> {
    const definitions = [
      NotificationSettingsTests.QUIET_DEFINITION,
      new SettingDefinition(NotificationSettingsTests.MUTED, "Muted", "Mutes modules.", SettingType.text(20), "tasks", SettingLocality.Shared, [], "Notifications", "Notifications")
    ];
    return NotificationSettingsTests.withSettingsAsync(definitions, (_, settings) => Assert.areEqual(0, settings.mutedModules.length));
  }

  private static async withSettingsAsync(definitions: readonly SettingDefinition[], act: (fixture: SettingsFixture, settings: NotificationSettings) => void): Promise<void> {
    await using fixture = await SettingsFixture.createAsync(definitions);
    act(fixture, new NotificationSettings(fixture.service));
  }
}
