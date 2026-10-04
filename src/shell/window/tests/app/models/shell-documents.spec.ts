/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ModulesComponent } from "../../../src/app/components/modules/modules.component";
import { SettingsComponent } from "../../../src/app/components/settings/settings.component";
import { ShellDocuments } from "../../../src/app/models/shell-documents";
import { Resources } from "../../../src/resources";

describe("ShellDocuments", () => {
  it("has Settings and Modules as the shell's documents, each in a tab without an instance, labelled with its title and glyph", async () => {
    expect(ShellDocuments.all.map(t => t.name)).toEqual(["shell.settings", "shell.modules"]);
    expect([ShellDocuments.settingsTab.key, ShellDocuments.settingsTab.instance]).toEqual(["document/shell.settings", undefined]);
    expect([ShellDocuments.settingsLabel.title, ShellDocuments.settingsLabel.icon]).toEqual(["Settings", "settings"]);
    expect(await ShellDocuments.settings.loadComponent()).toBe(SettingsComponent);
    expect([ShellDocuments.modulesTab.key, ShellDocuments.modulesTab.instance]).toEqual(["document/shell.modules", undefined]);
    expect([ShellDocuments.modulesLabel.title, ShellDocuments.modulesLabel.icon]).toEqual(["Modules", Resources.modulesGlyph]);
    expect(await ShellDocuments.modules.loadComponent()).toBe(ModulesComponent);
  });
});
