/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { QualifiedName, SettingDefinition, SettingLocality, SettingType } from "@noldova/teamrun-shell-protocol";

import { SettingsGroup } from "../../../../src/app/models/settings/settings-group";

describe("SettingsGroup", () => {
  it("holds a group's title and a copy of its definitions", () => {
    const mode = new SettingDefinition(QualifiedName.parse("shell.mode"), "Mode", "Light or dark.", SettingType.text(10), "System", SettingLocality.Shared, [], "Appearance", "Theme");
    const definitions = [mode];
    const group = new SettingsGroup("Theme", definitions);
    definitions.pop();

    expect([group.title, group.definitions]).toEqual(["Theme", [mode]]);
  });
});
