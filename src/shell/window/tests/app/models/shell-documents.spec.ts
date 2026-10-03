/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SettingsComponent } from "../../../src/app/components/settings/settings.component";
import { ShellDocuments } from "../../../src/app/models/shell-documents";

describe("ShellDocuments", () => {
  it("has Settings as the shell's one document, in a tab without an instance, labelled with its title and glyph", async () => {
    expect(ShellDocuments.all.map(t => t.name)).toEqual(["shell.settings"]);
    expect([ShellDocuments.settingsTab.key, ShellDocuments.settingsTab.instance]).toEqual(["document/shell.settings", undefined]);
    expect([ShellDocuments.settingsLabel.title, ShellDocuments.settingsLabel.icon]).toEqual(["Settings", "settings"]);
    expect(await ShellDocuments.settings.loadComponent()).toBe(SettingsComponent);
  });
});
