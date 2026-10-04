/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { ToolbarMove } from "../../../src/app/enums/toolbar-move";
import { CommandContribution } from "../../../src/app/models/command-contribution";
import { CommandRow } from "../../../src/app/models/command-row";
import { Layout } from "../../../src/app/models/layout/layout";
import { MenuDeclarations } from "../../../src/app/models/menu-declarations";
import { WindowPartTokens } from "../../../src/app/models/window-part-tokens";
import { CommandService } from "../../../src/app/services/command.service";
import type { LayoutService } from "../../../src/app/services/layout.service";
import { MenuService } from "../../../src/app/services/menu.service";
import { ToolbarService } from "../../../src/app/services/toolbar.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";
import { LayoutFixture } from "../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../fixtures/layout-service.fixture";

describe("ToolbarService", () => {
  const notes = MenuDeclarations.fromJson("notes", {
    places: [
      { name: "notes.main", title: "Main", shows: "toolbar", shown: true },
      { name: "notes.second", title: "Display", shows: "toolbar", shown: true, newRow: true },
      { name: "notes.spare", title: "Spare", shows: "toolbar", shown: false, after: "notes.main" },
      { name: "notes.empty", title: "Empty", shows: "toolbar", shown: true },
      { name: "notes.tools", title: "Notes", shows: "menuBar" }
    ],
    groups: [
      { name: "notes.mainCreate", place: "notes.main", exclusive: false, items: [{ command: "notes.newNote", arguments: {} }] },
      { name: "notes.secondDisplay", place: "notes.second", exclusive: false, items: [{ command: "notes.newNote", arguments: {} }] },
      { name: "notes.spareCreate", place: "notes.spare", exclusive: false, items: [{ command: "notes.newNote", arguments: {} }] },
      { name: "notes.emptyItems", place: "notes.empty", exclusive: false, items: [{ command: "notes.never", arguments: {} }] }
    ]
  });
  const registry = LayoutFixture.createRegistry();
  let layout: LayoutService;
  let service: ToolbarService;

  const shape = (): readonly (readonly string[])[] => service.rows().map(t => t.map(u => `${u.name}:${u.sections.length}`));

  beforeEach(async () => {
    DesktopBridgeFixture.install();
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.menus, useValue: [notes] }] });
    layout = await LayoutServiceFixture.prepareAsync(registry, Layout.createDefault(registry));
    TestBed.inject(CommandService).setCommands([
      new CommandContribution("notes.newNote", "New note", null, null, () => Promise.resolve(null)),
      new CommandContribution("notes.never", "Never", null, null, () => Promise.resolve(null), () => true, null, () => false)
    ]);
    service = TestBed.inject(ToolbarService);
    TestBed.inject(MenuService).setActiveModules(["notes"]);
  });

  afterEach(() => DesktopBridgeFixture.remove());

  it("lists the toolbars of the active modules and places them in rows by their declarations, counting one with nothing to show", () => {
    expect(service.places().map(t => t.name)).toEqual(["notes.main", "notes.second", "notes.spare", "notes.empty"]);
    expect(shape()).toEqual([["notes.main:1"], ["notes.second:1", "notes.empty:0"]]);
    expect(service.shown()).toEqual(["notes.main", "notes.second", "notes.empty"]);
    expect([service.rows()[0]?.[0]?.title, service.hasContent(), service.isKnown("notes.spare"), service.isKnown("notes.tools")]).toEqual(["Main", true, true, false]);
  });

  it("has no content while every shown toolbar is empty", () => {
    service.setShown("notes.main", false);
    service.setShown("notes.second", false);

    expect(service.hasContent()).toBe(false);
    expect(shape()).toEqual([["notes.empty:0"]]);
  });

  it("shows and hides a toolbar and keeps the arrangement in the layout", () => {
    service.setShown("notes.spare", true);

    expect(shape()).toEqual([["notes.main:1", "notes.spare:1"], ["notes.second:1", "notes.empty:0"]]);
    expect([service.isShown("notes.spare"), layout.layout().toolbars.isEmpty]).toEqual([true, false]);
    service.setShown("notes.main", false);
    expect([service.isShown("notes.main"), layout.layout().toolbars.hidden]).toEqual([false, ["notes.main"]]);
    service.setShown("notes.main", true);
    expect(service.isShown("notes.main")).toBe(true);
  });

  it("moves a toolbar within its row, to another row and to a new row, and returns to the declared arrangement on a reset", () => {
    service.setShown("notes.spare", true);

    service.move("notes.spare", 0, 0);
    expect(shape()[0]).toEqual(["notes.spare:1", "notes.main:1"]);
    service.moveToNewRow("notes.spare", 1);
    expect(shape()).toEqual([["notes.main:1"], ["notes.spare:1"], ["notes.second:1", "notes.empty:0"]]);
    layout.reset();
    expect(shape()).toEqual([["notes.main:1"], ["notes.second:1", "notes.empty:0"]]);
  });

  it("tells where a toolbar can move by one step and moves it there, to a new row at the first or last row's edge", () => {
    service.setShown("notes.spare", true);
    const can = (name: string): readonly boolean[] => Object.values(ToolbarMove).map(t => service.canMove(name, t));

    expect([can("notes.main"), can("notes.spare"), can("notes.second"), can("notes.empty"), can("notes.gone")]).toEqual([
      [false, true, true, true], [true, false, true, true], [false, true, true, true], [true, false, true, true], [false, false, false, false]
    ]);
    service.moveBy("notes.main", ToolbarMove.Right);
    expect(shape()[0]).toEqual(["notes.spare:1", "notes.main:1"]);
    service.moveBy("notes.main", ToolbarMove.Left);
    expect(shape()[0]).toEqual(["notes.main:1", "notes.spare:1"]);
    service.moveBy("notes.main", ToolbarMove.Left);
    service.moveBy("notes.gone", ToolbarMove.Right);
    expect(shape()[0]).toEqual(["notes.main:1", "notes.spare:1"]);
    service.moveBy("notes.second", ToolbarMove.Up);
    expect(shape()).toEqual([["notes.second:1", "notes.main:1", "notes.spare:1"], ["notes.empty:0"]]);
    service.moveBy("notes.second", ToolbarMove.Down);
    expect(shape()).toEqual([["notes.main:1", "notes.spare:1"], ["notes.second:1", "notes.empty:0"]]);
    service.moveBy("notes.main", ToolbarMove.Up);
    expect(shape()).toEqual([["notes.main:1"], ["notes.spare:1"], ["notes.second:1", "notes.empty:0"]]);
    service.moveBy("notes.second", ToolbarMove.Down);
    expect(shape()).toEqual([["notes.main:1"], ["notes.spare:1"], ["notes.empty:0"], ["notes.second:1"]]);
    service.moveBy("notes.second", ToolbarMove.Down);
    service.moveBy("notes.main", ToolbarMove.Up);
    expect(shape()).toEqual([["notes.main:1"], ["notes.spare:1"], ["notes.empty:0"], ["notes.second:1"]]);
  });

  it("lists every toolbar by its title in the dynamic group of the Toolbars menu", () => {
    const rows = TestBed.inject(MenuService).resolve("shell.toolbars").flatMap(t => t.rows).filter(t => t instanceof CommandRow);

    expect(rows.map(t => [t.title, t.command, t.commandArguments])).toEqual([
      ["Main", "shell.toggleToolbar", { toolbar: "notes.main" }], ["Display", "shell.toggleToolbar", { toolbar: "notes.second" }],
      ["Spare", "shell.toggleToolbar", { toolbar: "notes.spare" }], ["Empty", "shell.toggleToolbar", { toolbar: "notes.empty" }]
    ]);
  });
});
