/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { QualifiedName, SettingDefinition, SettingLocality, SettingOption, SettingType } from "@noldova/teamrun-shell-protocol";

import { ProductInfo } from "../../models/product-info.js";
import { Resources } from "../../resources.js";

export class ShellSettings {
  public static readonly theme: QualifiedName = ShellSettings.named(Resources.themeSetting);
  public static readonly mode: QualifiedName = ShellSettings.named(Resources.modeSetting);
  public static readonly interfaceFont: QualifiedName = ShellSettings.named(Resources.interfaceFontSetting);
  public static readonly codeFont: QualifiedName = ShellSettings.named(Resources.codeFontSetting);
  public static readonly panelSize: QualifiedName = ShellSettings.named(Resources.panelSizeSetting);
  public static readonly messageSize: QualifiedName = ShellSettings.named(Resources.messageSizeSetting);
  public static readonly codeSize: QualifiedName = ShellSettings.named(Resources.codeSizeSetting);
  public static readonly leftDockStyle: QualifiedName = ShellSettings.named(Resources.leftDockStyleSetting);
  public static readonly rightDockStyle: QualifiedName = ShellSettings.named(Resources.rightDockStyleSetting);
  public static readonly menuBar: QualifiedName = ShellSettings.named(Resources.menuBarSetting);
  public static readonly previewTabs: QualifiedName = ShellSettings.named(Resources.previewTabsSetting);
  public static readonly doNotDisturb: QualifiedName = ShellSettings.named(Resources.doNotDisturbSetting);
  public static readonly mutedModules: QualifiedName = ShellSettings.named(Resources.mutedModulesSetting);
  public static readonly trayIcon: QualifiedName = ShellSettings.named(Resources.trayIconSetting);
  public static readonly keyBindings: QualifiedName = ShellSettings.named(Resources.keyBindingsSetting);
  public static readonly recentCommandCount: QualifiedName = ShellSettings.named(Resources.recentCommandCountSetting);
  public static readonly spellCheck: QualifiedName = ShellSettings.named(Resources.spellCheckSetting);
  public static readonly spellCheckLanguages: QualifiedName = ShellSettings.named(Resources.spellCheckLanguagesSetting);

  private static readonly common: readonly SettingDefinition[] = [
    ShellSettings.appearance(ShellSettings.theme, Resources.themeTitle, Resources.formatThemeDescription(ProductInfo.current.name),
      SettingType.choice([new SettingOption(Resources.defaultThemeId, Resources.defaultThemeTitle)]), Resources.defaultThemeId, SettingLocality.Shared, Resources.themeGroup),
    ShellSettings.appearance(ShellSettings.mode, Resources.modeTitle, Resources.modeDescription,
      ShellSettings.choiceOf(Resources.modeOptions), Resources.defaultMode, SettingLocality.Shared, Resources.themeGroup),
    ShellSettings.appearance(ShellSettings.interfaceFont, Resources.interfaceFontTitle, Resources.interfaceFontDescription,
      ShellSettings.choiceOf(Resources.fontOptions), Resources.defaultFont, SettingLocality.Device, Resources.textGroup),
    ShellSettings.appearance(ShellSettings.codeFont, Resources.codeFontTitle, Resources.codeFontDescription,
      ShellSettings.choiceOf(Resources.fontOptions), Resources.defaultFont, SettingLocality.Device, Resources.textGroup),
    ShellSettings.appearance(ShellSettings.panelSize, Resources.panelSizeTitle, Resources.panelSizeDescription,
      ShellSettings.textSize(), Resources.defaultPanelSize, SettingLocality.Device, Resources.textGroup),
    ShellSettings.appearance(ShellSettings.messageSize, Resources.messageSizeTitle, Resources.messageSizeDescription,
      ShellSettings.textSize(), Resources.defaultMessageSize, SettingLocality.Device, Resources.textGroup),
    ShellSettings.appearance(ShellSettings.codeSize, Resources.codeSizeTitle, Resources.codeSizeDescription,
      ShellSettings.textSize(), Resources.defaultCodeSize, SettingLocality.Device, Resources.textGroup),
    ShellSettings.appearance(ShellSettings.leftDockStyle, Resources.leftDockStyleTitle, Resources.leftDockStyleDescription,
      ShellSettings.choiceOf(Resources.dockStyleOptions), Resources.defaultDockStyle, SettingLocality.Shared, Resources.layoutGroup),
    ShellSettings.appearance(ShellSettings.rightDockStyle, Resources.rightDockStyleTitle, Resources.rightDockStyleDescription,
      ShellSettings.choiceOf(Resources.dockStyleOptions), Resources.defaultDockStyle, SettingLocality.Shared, Resources.layoutGroup),
    ShellSettings.appearance(ShellSettings.menuBar, Resources.menuBarTitle, Resources.menuBarDescription,
      ShellSettings.choiceOf(Resources.menuBarOptions), Resources.defaultMenuBar, SettingLocality.Shared, Resources.layoutGroup),
    ShellSettings.appearance(ShellSettings.previewTabs, Resources.previewTabsTitle, Resources.previewTabsDescription,
      SettingType.boolean(), true, SettingLocality.Shared, Resources.layoutGroup),
    ShellSettings.appearance(ShellSettings.recentCommandCount, Resources.recentCommandCountTitle, Resources.recentCommandCountDescription,
      SettingType.number(0, Resources.maximumRecentCommands, 1), Resources.defaultRecentCommands, SettingLocality.Shared, Resources.commandSearchGroup),
    ShellSettings.appearance(ShellSettings.spellCheck, Resources.spellCheckTitle, Resources.spellCheckDescription,
      SettingType.boolean(), true, SettingLocality.Shared, Resources.spellingGroup),
    new SettingDefinition(ShellSettings.spellCheckLanguages, Resources.spellCheckLanguagesTitle, Resources.spellCheckLanguagesDescription,
      SettingType.languages(), [], SettingLocality.Device, [], Resources.appearancePage, Resources.spellingGroup),
    new SettingDefinition(ShellSettings.doNotDisturb, Resources.doNotDisturbTitle, Resources.doNotDisturbDescription,
      SettingType.boolean(), false, SettingLocality.Device, [], Resources.notificationsPage, Resources.notificationsGroup),
    new SettingDefinition(ShellSettings.mutedModules, Resources.mutedModulesTitle, Resources.mutedModulesDescription,
      SettingType.modules(), [], SettingLocality.Shared, [], Resources.notificationsPage, Resources.notificationsGroup)
  ];

  public static definitionsFor(platform: string): readonly SettingDefinition[] {
    const product = ProductInfo.current.name;
    return [
      ...ShellSettings.common,
      new SettingDefinition(ShellSettings.trayIcon, Resources.formatTrayIconTitle(product, platform), Resources.formatTrayIconDescription(product),
        SettingType.boolean(), platform !== Resources.macPlatform, SettingLocality.Device, [], Resources.notificationsPage, Resources.backgroundGroup),
      new SettingDefinition(ShellSettings.keyBindings, Resources.keyBindingsTitle, Resources.keyBindingsDescription,
        SettingType.keyBindings(), {}, SettingLocality.Shared, [], Resources.shortcutsPage, Resources.shortcutsGroup)
    ];
  }

  private static named(member: string): QualifiedName {
    return new QualifiedName(Resources.reservedModuleId, member);
  }

  private static choiceOf(options: readonly (readonly [string, string])[]): SettingType {
    return SettingType.choice(options.map(([value, title]) => new SettingOption(value, title)));
  }

  private static textSize(): SettingType {
    return SettingType.number(Resources.minimumTextSize, Resources.maximumTextSize, Resources.textSizeStep);
  }

  private static appearance(
    name: QualifiedName,
    title: string,
    description: string,
    type: SettingType,
    defaultValue: string | number | boolean,
    locality: SettingLocality,
    group: string
  ): SettingDefinition {
    return new SettingDefinition(name, title, description, type, defaultValue, locality, [], Resources.appearancePage, group);
  }
}
