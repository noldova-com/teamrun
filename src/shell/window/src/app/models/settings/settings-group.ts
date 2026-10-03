/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SettingDefinition } from "@noldova/teamrun-shell-protocol";

export class SettingsGroup {
  public readonly title: string;
  public readonly definitions: readonly SettingDefinition[];

  public constructor(title: string, definitions: readonly SettingDefinition[]) {
    this.title = title;
    this.definitions = [...definitions];
  }
}
