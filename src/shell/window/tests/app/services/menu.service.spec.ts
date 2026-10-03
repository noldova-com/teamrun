/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { JsonReader, type JsonValue } from "@noldova/teamrun-foundation-json";

import { MenuCheck } from "../../../src/app/enums/menu-check";
import { CommandContribution } from "../../../src/app/models/command-contribution";
import { CommandRow } from "../../../src/app/models/command-row";
import { MenuDeclarations } from "../../../src/app/models/menu-declarations";
import type { MenuSection } from "../../../src/app/models/menu-section";
import { SubmenuRow } from "../../../src/app/models/submenu-row";
import { WindowPartTokens } from "../../../src/app/models/window-part-tokens";
import { CommandService } from "../../../src/app/services/command.service";
import { MenuService } from "../../../src/app/services/menu.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

describe("MenuService", () => {
  const notes = MenuDeclarations.fromJson("notes", {
    places: [{ name: "notes.listItem", title: "Note", menuBar: false }, { name: "notes.templates", title: "New from template", menuBar: false }],
    groups: [
      { name: "notes.open", place: "notes.listItem", exclusive: false, items: [{ command: "notes.openNote", arguments: { pinned: true, week: 0 } }, { submenu: "notes.templates" }] },
      { name: "notes.sorting", place: "notes.listItem", exclusive: true, items: [{ command: "notes.sortBy", arguments: { by: "title" } }, { command: "notes.sortBy", arguments: { by: "week" } }] },
      { name: "notes.display", place: "notes.listItem", exclusive: false, items: [{ command: "notes.wrapLines", arguments: {} }, { command: "notes.missing", arguments: {} }] },
      { name: "notes.create", place: "shell.file", exclusive: false, items: [{ command: "notes.newNote", arguments: {} }] },
      { name: "notes.nowhere", place: "notes.listItem", exclusive: false, items: [{ submenu: "notes.gone" }] }
    ]
  });
  const tasks = MenuDeclarations.fromJson("tasks", {
    places: [],
    groups: [{ name: "tasks.share", place: "notes.listItem", exclusive: false, items: [{ command: "tasks.add", arguments: {} }] }]
  });
  let sortBy: string;

  function start(...declarations: readonly MenuDeclarations[]): MenuService {
    DesktopBridgeFixture.install();
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.menus, useValue: declarations }] });
    const reader = (value: JsonValue): JsonReader => JsonReader.fromValue(value);
    TestBed.inject(CommandService).setCommands([
      new CommandContribution("notes.openNote", "Open note", "open_in_new", "Mod+Alt+O", () => Promise.resolve(null), t => reader(t).readInteger("week") > 0),
      new CommandContribution("notes.sortBy", "Sort by", null, null, () => Promise.resolve(null), () => true, t => reader(t).readString("by") === sortBy),
      new CommandContribution("notes.wrapLines", "Wrap lines", null, null, () => Promise.resolve(null), () => true, () => true),
      new CommandContribution("notes.newNote", "New note", null, null, () => Promise.resolve(null)),
      new CommandContribution("tasks.add", "Add a task", null, null, () => Promise.resolve(null))
    ]);
    return TestBed.inject(MenuService);
  }

  function describeSections(sections: readonly MenuSection[]): readonly (readonly string[])[] {
    return sections.map(t => t.rows.map(u => u instanceof CommandRow
      ? `${u.title}${u.isEnabled ? "" : " (disabled)"}${u.check === MenuCheck.None ? "" : ` ${u.check}:${u.isChecked}`}${Object.isNull(u.key) ? "" : ` ${u.key}`}`
      : `${u.title} >`));
  }

  beforeEach(() => sortBy = "week");

  afterEach(() => DesktopBridgeFixture.remove());

  it("shows only the shell's own places until modules are active, then theirs in module order", () => {
    const menus = start(notes, tasks);

    const before = menus.resolve("notes.listItem", { week: 3 });
    menus.setActiveModules(["tasks", "notes"]);

    expect(before).toEqual([]);
    expect(menus.findPlace("shell.file")?.title).toBe("File");
    expect(menus.findPlace("notes.listItem")?.title).toBe("Note");
    expect(menus.findPlace("clock.face")).toBeNull();
    expect(menus.active().map(t => t.moduleId)).toEqual(["shell", "tasks", "notes"]);
    expect(describeSections(menus.resolve("notes.listItem", { week: 3 }))).toEqual([
      ["Add a task"],
      ["Open note (disabled) Ctrl+Alt+O", "New from template >"],
      ["Sort by Radio:false", "Sort by Radio:true"],
      ["Wrap lines Checkbox:true", "notes.missing (disabled)"]
    ]);
  });

  it("merges the menu's context with an item's arguments, the item's own fields winning", () => {
    const menus = start(notes);
    menus.setActiveModules(["notes"]);

    const [opening] = menus.resolve("notes.listItem", { week: 3, title: "Week 3" }).flatMap(t => t.rows).filter(t => t instanceof CommandRow);
    const [closed] = menus.resolve("notes.listItem", { title: "Week 3" }).flatMap(t => t.rows).filter(t => t instanceof CommandRow);

    expect((opening as CommandRow).commandArguments).toEqual({ week: 0, title: "Week 3", pinned: true });
    expect((opening as CommandRow).isEnabled).toBe(false);
    expect((closed as CommandRow).commandArguments).toEqual({ title: "Week 3", pinned: true, week: 0 });
  });

  it("offers a submenu by its place's title and leaves out a submenu whose place is not active and a place with no rows", () => {
    const menus = start(notes);
    menus.setActiveModules(["notes"]);

    const rows = menus.resolve("notes.listItem").flatMap(t => t.rows);

    expect(rows.filter(t => t instanceof SubmenuRow).map(t => [t.title, (t as SubmenuRow).place])).toEqual([["New from template", "notes.templates"]]);
    expect(menus.resolve("notes.templates")).toEqual([]);
    expect(describeSections(menus.resolve("shell.file"))).toEqual([["New note"]]);
  });
});
