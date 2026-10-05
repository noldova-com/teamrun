/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MenuDeclarations } from "../../../src/app/models/menu-declarations";
import { MenuGroup } from "../../../src/app/models/menu-group";
import { MenuItem } from "../../../src/app/models/menu-item";
import { MenuPlace } from "../../../src/app/models/menu-place";
import { ToolbarPlacement } from "../../../src/app/models/toolbar-placement";

describe("MenuDeclarations", () => {
  it("reads a module's places, groups and items from the build's description", () => {
    const menus = MenuDeclarations.fromJson("notes", {
      places: [{ name: "notes.tools", title: "Notes", shows: "menuBar" }, { name: "notes.templates", title: "Templates", shows: "menu" }, { name: "notes.context", title: "Context" }],
      groups: [{ name: "notes.sorting", place: "notes.tools", exclusive: true, items: [{ command: "notes.sortBy", arguments: { by: "title" }, label: "By title" }, { submenu: "notes.templates" }] }]
    });

    expect(menus.moduleId).toBe("notes");
    expect(menus.places).toEqual([new MenuPlace("notes.tools", "Notes", true), new MenuPlace("notes.templates", "Templates", false), new MenuPlace("notes.context", "Context", false)]);
    expect(menus.groups).toEqual([new MenuGroup("notes.sorting", "notes.tools", true, [MenuItem.ofCommand("notes.sortBy", { by: "title" }, "By title"), MenuItem.ofSubmenu("notes.templates")])]);
    expect([menus.groups[0]?.items[1]?.command, menus.groups[0]?.items[1]?.submenu, menus.groups[0]?.items[0]?.submenu]).toEqual([null, "notes.templates", null]);
  });

  it("reads a toolbar's default, its preferred position, a choice item and a dynamic group", () => {
    const menus = MenuDeclarations.fromJson("notes", {
      places: [
        { name: "notes.main", title: "Main", shows: "toolbar", shown: true },
        { name: "notes.second", title: "Second", shows: "toolbar", shown: false, after: "notes.main" },
        { name: "notes.third", title: "Third", shows: "toolbar", shown: true, before: "notes.main" },
        { name: "notes.fourth", title: "Fourth", shows: "toolbar", shown: true, newRow: true }
      ],
      groups: [
        { name: "notes.sort", place: "notes.main", exclusive: false, items: [{ choice: "notes.sorting" }] },
        { name: "notes.recent", place: "notes.main", exclusive: true, dynamic: true },
        { name: "notes.fixed", place: "notes.main", exclusive: false, dynamic: false, items: [{ command: "notes.newNote", arguments: {} }] }
      ]
    });

    expect(menus.places.map(t => t.toolbar)).toEqual([new ToolbarPlacement(true), new ToolbarPlacement(false, "notes.main"), new ToolbarPlacement(true, null, "notes.main"),
      new ToolbarPlacement(true, null, null, true)]);
    expect(menus.places.map(t => t.isMenuBar)).toEqual([false, false, false, false]);
    expect(menus.groups[0]?.items[0]?.choice).toBe("notes.sorting");
    expect([menus.groups[1]?.isDynamic, menus.groups[1]?.isExclusive, menus.groups[1]?.items, menus.groups[2]?.isDynamic]).toEqual([true, true, [], false]);
  });
});
