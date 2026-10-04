/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import type { JsonValue } from "@noldova/teamrun-foundation-json";

import { CommandSearchComponent } from "../../../../src/app/components/command-search/command-search.component";
import { CommandContribution } from "../../../../src/app/models/command-contribution";
import { MenuDeclarations } from "../../../../src/app/models/menu-declarations";
import { WindowPartSource } from "../../../../src/app/models/window-part-source";
import { WindowPartTokens } from "../../../../src/app/models/window-part-tokens";
import { CommandSearchService } from "../../../../src/app/services/command-search.service";
import { CommandService } from "../../../../src/app/services/command.service";
import { MenuBarService } from "../../../../src/app/services/menu-bar.service";
import { MenuService } from "../../../../src/app/services/menu.service";
import { Resources } from "../../../../src/resources";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";

describe("CommandSearchComponent", () => {
  let fixture: ComponentFixture<CommandSearchComponent>;
  let commands: CommandService;
  let search: CommandSearchService;
  let menuBar: MenuBarService;
  let runs: string[];
  let received: JsonValue[];

  const command = (name: string, title: string, key: string | null = null, isEnabled: boolean = true): CommandContribution =>
    new CommandContribution(name, title, null, key, async commandArguments => {
      runs.push(name);
      received.push(commandArguments);
      return null;
    }, () => isEnabled);

  beforeEach(async () => {
    runs = [];
    received = [];
    DesktopBridgeFixture.install("win32");
    TestBed.configureTestingModule({
      providers: [
        { provide: WindowPartTokens.sources, useValue: [new WindowPartSource("notes", "Notes", [], [], [], ["notes.newNote"], [], [], [], () => Promise.reject(new Error("Not loaded.")))] },
        {
          provide: WindowPartTokens.menus, useValue: [MenuDeclarations.fromJson("notes", {
            places: [{ name: "notes.templates", title: "New from template", menuBar: false }],
            groups: [
              { name: "notes.create", place: "shell.file", exclusive: false, items: [{ command: "notes.newNote", arguments: {} }, { submenu: "notes.templates" }] },
              { name: "notes.fromTemplate", place: "notes.templates", exclusive: false, items: [{ command: "notes.newNote", arguments: { template: "plan" } }] },
              { name: "notes.shown", place: "shell.view", exclusive: false, items: [{ command: "weather.today", arguments: {}, label: "Forecast" }, { command: "notes.newNote", arguments: {}, label: "Quick note" }] },
              { name: "notes.locked", place: "shell.view", exclusive: false, items: [{ command: "notes.archive", arguments: { force: true } }] }
            ]
          })]
        }
      ]
    });
    commands = TestBed.inject(CommandService);
    search = TestBed.inject(CommandSearchService);
    menuBar = TestBed.inject(MenuBarService);
    commands.setCommands([
      command("notes.newNote", "New note", "Mod+Alt+N"), command("notes.archive", "Archive the note", null, false), command("weather.today", "Today's weather"), command("weather.tools", "Open the tools"), command("weather.pluto", "Pluto"), command("weather.photo", "Photo")
    ]);
    TestBed.inject(MenuService).setActiveModules(["notes"]);
    fixture = TestBed.createComponent(CommandSearchComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => DesktopBridgeFixture.remove());

  function root(): HTMLElement {
    return fixture.nativeElement;
  }

  function ids(): string[] {
    return [...root().querySelectorAll<HTMLElement>("[role=option]")].map(t => t.dataset["item"] ?? "");
  }

  async function typeAsync(text: string): Promise<void> {
    const field = root().querySelector<HTMLInputElement>(".tr-quick-input-field");
    if (field === null)
      throw new Error("No field.");
    field.value = text;
    field.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it("lists every enabled command and menu row by category and title, with the ones run this session first, latest first, and leaves out a disabled one", async () => {
    const rows = [...root().querySelectorAll("[role=option]")].map(t => [t.querySelector(".tr-quick-input-detail")?.textContent?.trim(), t.querySelector(".tr-quick-input-title")?.textContent?.trim()]);
    expect(rows).toHaveLength(commands.commands().filter(t => t.isEnabled(null)).length + menuBar.searchRows().length);
    expect(rows).toEqual([...rows].sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1]))));
    expect(rows.slice(-4)).toEqual([["weather", "Open the tools"], ["weather", "Photo"], ["weather", "Pluto"], ["weather", "Today's weather"]]);
    expect(ids()).not.toContain("notes.archive");

    search.remember("weather.today");
    search.remember("notes.newNote");
    fixture.detectChanges();
    await fixture.whenStable();

    expect(ids().slice(0, 2)).toEqual(["notes.newNote", "weather.today"]);
  });

  it("keeps the rows whose title, or category followed by the title, contains the query as one run, in the same order, and marks the run", async () => {
    const marks = (id: string, part: string): readonly (string | null)[] => [...root().querySelectorAll(`[data-item="${id}"] .tr-quick-input-${part} mark`)].map(t => t.textContent);
    search.remember("weather.pluto");

    await typeAsync("TO");
    const to = [ids().filter(t => t.startsWith("weather.") || ids().indexOf(t) === 0), marks("weather.tools", "title"), root().querySelector("[data-item=\"weather.tools\"] .tr-quick-input-title")?.textContent];
    await typeAsync("weather p");
    const category = [ids(), marks("weather.photo", "detail"), marks("weather.photo", "title")];
    await typeAsync("nn");

    expect(to).toEqual([["weather.pluto", "weather.tools", "weather.photo", "weather.today"], ["to"], "Open the tools"]);
    expect(category).toEqual([["weather.pluto", "weather.photo"], ["weather"], ["P"]]);
    expect(ids()).toEqual([]);
  });

  it("shows each command's owner and key, naming the shell's commands after the product and an unknown module by its id", () => {
    const detail = (id: string): string | null | undefined => root().querySelector(`[data-item="${id}"] .tr-quick-input-detail`)?.textContent;
    const key = (id: string): string | null | undefined => root().querySelector(`[data-item="${id}"] .tr-quick-input-key`)?.textContent;

    expect([detail("notes.newNote"), detail("shell.showCommands"), detail("weather.today")]).toEqual(["Notes", Resources.productName, "weather"]);
    expect([key("notes.newNote"), key("shell.showCommands"), key("shell.closeTab")]).toEqual(["Ctrl+Alt+N", "Ctrl+Shift+P", undefined]);
  });

  it("runs the chosen command after closing the search, and remembers it", async () => {
    const close = vi.spyOn(search, "close");
    const row = vi.spyOn(menuBar, "run");
    await typeAsync("new note");

    root().querySelector<HTMLElement>("[data-item='notes.newNote']")?.click();

    await vi.waitFor(() => expect(runs).toEqual(["notes.newNote"]));
    expect(row).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
    expect(search.recent()).toEqual(["notes.newNote"]);
  });

  it("lists a menu row that passes arguments, with its menu as the detail and no key, but not one that runs a command alone under any label", async () => {
    const detail = (id: string): string | null | undefined => root().querySelector(`[data-item="${id}"] .tr-quick-input-detail`)?.textContent;
    const key = (id: string): string | null | undefined => root().querySelector(`[data-item="${id}"] .tr-quick-input-key`)?.textContent;
    const rows = menuBar.searchRows();
    const template = rows.find(t => t.title === "New note")?.id ?? "";

    expect(rows.map(t => [t.title, t.menu])).toEqual([["New note", "File › New from template"]]);
    expect(ids().filter(t => t.startsWith("shell.file/"))).toEqual([template]);
    expect([detail(template), key(template)]).toEqual(["File › New from template", undefined]);

    await typeAsync("new note");
    expect(ids()).toEqual([template, "notes.newNote"]);
    await typeAsync("forecast");
    expect(ids()).toEqual([]);
    await typeAsync("quick note");
    expect(ids()).toEqual([]);
  });

  it("runs a chosen menu row with its arguments after closing the search, and remembers it", async () => {
    const close = vi.spyOn(search, "close");
    const template = menuBar.searchRows().find(t => t.title === "New note")?.id ?? "";
    await typeAsync("new note");

    root().querySelector<HTMLElement>(`[data-item="${template}"]`)?.click();

    await vi.waitFor(() => expect(received).toEqual([{ template: "plan" }]));
    expect(runs).toEqual(["notes.newNote"]);
    expect(close).toHaveBeenCalledOnce();
    expect(search.recent()).toEqual([template]);
  });

  it("closes the search when it is dismissed", () => {
    const close = vi.spyOn(search, "close");

    root().querySelector(".tr-quick-input-field")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

    expect(close).toHaveBeenCalledOnce();
  });
});
