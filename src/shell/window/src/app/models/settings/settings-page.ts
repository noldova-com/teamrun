/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SettingDefinition } from "@noldova/teamrun-shell-protocol";

import { Resources } from "../../../resources";
import { SettingsGroup } from "./settings-group";

export class SettingsPage {
  public readonly title: string;
  public readonly groups: readonly SettingsGroup[];
  public readonly isShortcuts: boolean;

  public constructor(title: string, groups: readonly SettingsGroup[], isShortcuts: boolean = false) {
    this.title = title;
    this.groups = [...groups];
    this.isShortcuts = isShortcuts;
  }

  public static pagesOf(definitions: readonly SettingDefinition[]): readonly SettingsPage[] {
    const titles = [...new Set([...Resources.leadingSettingsPages, ...definitions.map(t => t.page)])];
    return titles.map(title => title === Resources.shortcutsPage
      ? new SettingsPage(title, [], true)
      : new SettingsPage(title, SettingsPage.groupsOf(definitions.filter(t => t.page === title))));
  }

  public filter(isMatch: (definition: SettingDefinition) => boolean): SettingsPage {
    return new SettingsPage(this.title, this.groups.map(t => new SettingsGroup(t.title, t.definitions.filter(isMatch))).filter(t => t.definitions.length > 0), this.isShortcuts);
  }

  private static groupsOf(definitions: readonly SettingDefinition[]): readonly SettingsGroup[] {
    return [...new Set(definitions.map(t => t.group))].map(group => new SettingsGroup(group, definitions.filter(t => t.group === group)));
  }
}
