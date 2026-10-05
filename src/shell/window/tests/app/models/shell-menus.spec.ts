/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { ShellMenus } from "../../../src/app/models/shell-menus";

describe("ShellMenus", () => {
  it("declares the shell's menus, with the menu bar's places first, and the editing group only where the system does not give one", () => {
    const mac = ShellMenus.of(true);
    const other = ShellMenus.of(false);

    expect([mac.moduleId, other.moduleId]).toEqual(["shell", "shell"]);
    expect(mac.places).toEqual(other.places);
    expect(mac.places.filter(t => t.isMenuBar).map(t => t.name)).toEqual(["shell.file", "shell.edit", "shell.view", "shell.window", "shell.help"]);
    expect(mac.places.length).toBe(12);
    expect(mac.groups.some(t => t.name === "shell.editing")).toBe(false);
    expect(other.groups.slice(1)).toEqual(mac.groups);
    expect([other.groups[0]?.name, other.groups[0]?.place, other.groups[0]?.items.map(t => t.command)])
      .toEqual(["shell.editing", "shell.edit", ["shell.undo", "shell.redo", "shell.cut", "shell.copy", "shell.paste", "shell.selectAll"]]);
    expect(mac.groups.filter(t => t.isDynamic).length).toBe(2);
  });
});
