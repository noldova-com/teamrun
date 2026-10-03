/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { MenuDeclarations } from "../../../src/app/models/menu-declarations";
import { MenuGroup } from "../../../src/app/models/menu-group";
import { MenuItem } from "../../../src/app/models/menu-item";
import { MenuPlace } from "../../../src/app/models/menu-place";

describe("MenuDeclarations", () => {
  it("reads a module's places, groups and items from the build's description", () => {
    const menus = MenuDeclarations.fromJson("notes", {
      places: [{ name: "notes.tools", title: "Notes", menuBar: true }],
      groups: [{ name: "notes.sorting", place: "notes.tools", exclusive: true, items: [{ command: "notes.sortBy", arguments: { by: "title" } }, { submenu: "notes.templates" }] }]
    });

    expect(menus.moduleId).toBe("notes");
    expect(menus.places).toEqual([new MenuPlace("notes.tools", "Notes", true)]);
    expect(menus.groups).toEqual([new MenuGroup("notes.sorting", "notes.tools", true, [MenuItem.ofCommand("notes.sortBy", { by: "title" }), MenuItem.ofSubmenu("notes.templates")])]);
    expect([menus.groups[0]?.items[1]?.command, menus.groups[0]?.items[1]?.submenu, menus.groups[0]?.items[0]?.submenu]).toEqual([null, "notes.templates", null]);
  });

  it("refuses an invalid name, a blank title, an empty group and a command or submenu that is not a qualified name", () => {
    expect(() => new MenuPlace("tools", "Notes", false)).toThrowError(ArgumentException);
    expect(() => new MenuPlace("notes.tools", " ", false)).toThrowError(ArgumentException);
    expect(() => new MenuGroup("notes.sorting", "notes.tools", false, [])).toThrowError("A menu group has at least one item.");
    expect(() => new MenuGroup("notes.sorting", "tools", false, [MenuItem.ofCommand("notes.sortBy")])).toThrowError(ArgumentException);
    expect(() => MenuItem.ofCommand("sortBy")).toThrowError(ArgumentException);
    expect(() => MenuItem.ofSubmenu("templates")).toThrowError(ArgumentException);
    expect(MenuItem.ofCommand("notes.sortBy").commandArguments).toEqual({});
  });
});
