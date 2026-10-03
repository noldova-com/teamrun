/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { JsonReader, type JsonValue } from "@noldova/teamrun-foundation-json";

import { CommandContribution } from "../../../src/app/models/command-contribution";
import { MenuDeclarations } from "../../../src/app/models/menu-declarations";
import { WindowPartTokens } from "../../../src/app/models/window-part-tokens";
import { CommandService } from "../../../src/app/services/command.service";
import { MenuBarService } from "../../../src/app/services/menu-bar.service";
import { MenuService } from "../../../src/app/services/menu.service";
import { Resources } from "../../../src/resources";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

describe("MenuBarService", () => {
  let runs: string[];
  let sortBy: string;

  function start(): MenuBarService {
    runs = [];
    sortBy = "week";
    DesktopBridgeFixture.install();
    TestBed.configureTestingModule({
      providers: [{
        provide: WindowPartTokens.menus, useValue: [MenuDeclarations.fromJson("notes", {
          places: [{ name: "notes.tools", title: "Notes", menuBar: true }, { name: "notes.templates", title: "New from template", menuBar: false }],
          groups: [
            { name: "notes.create", place: "shell.file", exclusive: false, items: [{ command: "notes.newNote", arguments: {} }] },
            { name: "notes.sorting", place: "notes.tools", exclusive: true, items: [{ command: "notes.sortBy", arguments: { by: "title" } }, { command: "notes.sortBy", arguments: { by: "week" } }] },
            { name: "notes.more", place: "notes.tools", exclusive: false, items: [{ submenu: "notes.templates" }, { command: "notes.locked", arguments: {} }] },
            { name: "notes.fromTemplate", place: "notes.templates", exclusive: false, items: [{ command: "notes.newNote", arguments: { template: "plan" } }] }
          ]
        })]
      }]
    });
    const record = (t: JsonValue): Promise<JsonValue> => {
      runs.push(JSON.stringify(t));
      return Promise.resolve(null);
    };
    TestBed.inject(CommandService).setCommands([
      new CommandContribution("notes.newNote", "New note", "note_add", "Mod+Alt+N", record),
      new CommandContribution("notes.sortBy", "Sort by", null, null, record, () => true, t => JsonReader.fromValue(t).readString("by") === sortBy),
      new CommandContribution("notes.locked", "Locked", null, null, record, () => false)
    ]);
    TestBed.inject(MenuService).setActiveModules(["notes"]);
    return TestBed.inject(MenuBarService);
  }

  afterEach(() => DesktopBridgeFixture.remove());

  it("orders the menu bar File, Edit, View, then the modules' menus, then Window and Help, and shows only those with rows", () => {
    const bar = start();

    expect(bar.places().map(t => t.name)).toEqual(["shell.file", "shell.edit", "shell.view", "notes.tools", "shell.window", "shell.help"]);
    expect(bar.shownPlaces().map(t => t.title)).toEqual(["File", "Edit", "View", "Notes"]);
  });

  it("describes each menu's rows for the desktop, with ids, keys, enabled and checked state, separators and submenus", () => {
    const tree = start().tree();
    const menus = JsonReader.fromValue(tree).readObjectArray("menus").map(t => t.toJson());

    expect(menus.map(t => t["place"])).toEqual(["shell.app", "shell.file", "shell.edit", "shell.view", "notes.tools", "shell.window", "shell.help"]);
    expect(menus[0]).toEqual({
      place: "shell.app", title: Resources.productName, rows: [
        { type: "command", id: "shell.app/shell.settings/0", label: "Settings…", key: "Mod+Comma", enabled: false, check: "None", checked: false }
      ]
    });
    expect(menus[4]).toEqual({
      place: "notes.tools", title: "Notes", rows: [
        { type: "command", id: "notes.tools/notes.sorting/0", label: "Sort by", key: null, enabled: true, check: "Radio", checked: false },
        { type: "command", id: "notes.tools/notes.sorting/1", label: "Sort by", key: null, enabled: true, check: "Radio", checked: true },
        { type: "separator" },
        {
          type: "submenu", label: "New from template", rows: [
            { type: "command", id: "notes.tools/notes.more/0/notes.templates/notes.fromTemplate/0", label: "New note", key: "Mod+Alt+N", enabled: true, check: "None", checked: false }
          ]
        },
        { type: "command", id: "notes.tools/notes.more/1", label: "Locked", key: null, enabled: false, check: "None", checked: false }
      ]
    });
    expect(menus[2]).toEqual({
      place: "shell.edit", title: "Edit", rows: ["Undo", "Redo", "Cut", "Copy", "Paste", "Select all"]
        .map((t, i) => ({ type: "command", id: `shell.edit/shell.editing/${i}`, label: t, key: null, enabled: false, check: "None", checked: false }))
    });
  });

  it("runs the row an id names with its arguments, including one in a submenu", async () => {
    const bar = start();

    bar.run("notes.tools/notes.sorting/0");
    bar.run("notes.tools/notes.more/0/notes.templates/notes.fromTemplate/0");
    await Promise.resolve();

    expect(runs).toEqual([JSON.stringify({ by: "title" }), JSON.stringify({ template: "plan" })]);
  });

  it("ignores an id for a disabled row or a row that no longer exists", async () => {
    const bar = start();

    for (const id of ["notes.tools/notes.more/1", "notes.tools", "notes.tools/notes.gone/0", "notes.tools/notes.sorting/7", "notes.tools/notes.more/0",
      "notes.tools/notes.sorting/0/notes.templates/notes.fromTemplate/0", "notes.tools/notes.more/0/notes.other/notes.fromTemplate/0"])
      bar.run(id);
    await Promise.resolve();

    expect(runs).toEqual([]);
  });

  it("describes the rows again when the commands change", () => {
    const bar = start();
    const checked = (): readonly boolean[] | undefined => JsonReader.fromValue(bar.tree()).readObjectArray("menus")[4]?.readObjectArray("rows").slice(0, 2)
      .map(t => t.readBoolean("checked"));
    const before = checked();

    sortBy = "title";
    TestBed.inject(CommandService).setCommands([...TestBed.inject(CommandService).commands().filter(t => t.name.startsWith("notes."))]);

    expect([before, checked()]).toEqual([[false, true], [true, false]]);
  });
});
