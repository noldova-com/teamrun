/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { QualifiedName, SettingDefinition, SettingLocality, SettingOption, SettingType } from "@noldova/teamrun-shell-protocol";

export class SettingsFixture {
  public static readonly mode: SettingDefinition = SettingsFixture.define("shell.mode", "Mode", "Follow the operating system, or always light or dark.",
    SettingType.choice([new SettingOption("System", "System"), new SettingOption("Light", "Light"), new SettingOption("Dark", "Dark")]), "System", "Appearance", "Theme");
  public static readonly accent: SettingDefinition = SettingsFixture.define("shell.accent", "Accent", "The color that marks the selection.",
    SettingType.choice(["Blue", "Green", "Orange", "Red", "Violet"].map(t => new SettingOption(t, t))), "Blue", "Appearance", "Theme");
  public static readonly theme: SettingDefinition = SettingsFixture.define("shell.theme", "Theme", "The colors and look of the window.",
    SettingType.choice([new SettingOption("Default", "Default")]), "Default", "Appearance", "Theme");
  public static readonly panelSize: SettingDefinition = SettingsFixture.define("shell.panelSize", "Interface text size", "The size of interface text, in pixels.",
    SettingType.number(12, 18, 1), 13, "Appearance", "Text");
  public static readonly doNotDisturb: SettingDefinition = SettingsFixture.define("shell.doNotDisturb", "Do not disturb", "Holds back notifications on this device.",
    SettingType.boolean(), false, "Notifications", "Notifications");
  public static readonly mutedModules: SettingDefinition = SettingsFixture.define("shell.mutedModules", "Notifications from modules", "Modules whose notifications are not shown.",
    SettingType.modules(), [], "Notifications", "Notifications");
  public static readonly spellCheckLanguages: SettingDefinition = SettingsFixture.define("shell.spellCheckLanguages", "Spelling languages", "The languages words are checked in.",
    SettingType.languages(), [], "Appearance", "Spelling");
  public static readonly trayIcon: SettingDefinition = SettingsFixture.define("shell.trayIcon", "Show TeamRun in the tray",
    "An icon that shows when work is running or notifications are unread.", SettingType.boolean(), true, "Notifications", "In the background");
  public static readonly greeting: SettingDefinition = SettingsFixture.define("clock.greeting", "Greeting", "What the clock says at noon.",
    SettingType.text(20), "Noon", "Clock", "Words");
  public static readonly tickStep: SettingDefinition = SettingsFixture.define("clock.tickStep", "Tick step", "How far each tick moves the clock.",
    SettingType.number(1, 10, 1), 1, "Clock", "Ticks");
  public static readonly alarms: SettingDefinition = SettingsFixture.define("clock.alarms", "Alarms", "The times the clock rings, in a tab of their own.",
    SettingType.action(QualifiedName.parse("clock.openAlarms"), "Open alarms"), null, "Clock", "Ticks");
  public static readonly all: readonly SettingDefinition[] = [
    SettingsFixture.mode, SettingsFixture.panelSize, SettingsFixture.doNotDisturb, SettingsFixture.mutedModules, SettingsFixture.greeting, SettingsFixture.tickStep
  ];

  public static define(name: string, title: string, description: string, type: SettingType, defaultValue: JsonValue, page: string, group: string): SettingDefinition {
    return new SettingDefinition(QualifiedName.parse(name), title, description, type, defaultValue, SettingLocality.Shared, [], page, group);
  }
}
