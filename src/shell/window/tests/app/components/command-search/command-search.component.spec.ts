/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import type { JsonValue } from "@noldova/teamrun-foundation-json";

import { CommandSearchComponent } from "../../../../src/app/components/command-search/command-search.component";
import { CommandContribution } from "../../../../src/app/models/command-contribution";
import { MenuDeclarations } from "../../../../src/app/models/menu-declarations";
import { WindowPartTokens } from "../../../../src/app/models/window-part-tokens";
import { CommandSearchService } from "../../../../src/app/services/command-search.service";
import { CommandService } from "../../../../src/app/services/command.service";
import { MenuBarService } from "../../../../src/app/services/menu-bar.service";
import { MenuService } from "../../../../src/app/services/menu.service";
import { RecentCommandsService } from "../../../../src/app/services/recent-commands.service";
import { WindowPartHostService } from "../../../../src/app/services/window-part-host.service";
import { Resources } from "../../../../src/resources";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";
import { ModuleStatusFixture } from "../../../fixtures/module-status.fixture";

describe("CommandSearchComponent", () => {
  let fixture: ComponentFixture<CommandSearchComponent>;
  let commands: CommandService;
  let search: CommandSearchService;
  let menuBar: MenuBarService;
  let bridge: DesktopBridgeFixture;
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
    bridge = DesktopBridgeFixture.install("win32");
    TestBed.configureTestingModule({
      providers: [
        { provide: WindowPartHostService, useValue: { generation: signal(1) } },
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
    ModuleStatusFixture.report(ModuleStatusFixture.create("notes", "Notes"));
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

  async function showAsync(limit: number, recent: readonly string[]): Promise<void> {
    await vi.waitFor(() => expect(bridge.requests.map(t => t[0])).toContain("shell.recentCommands"));
    await fixture.whenStable();
    bridge.publishEvent("shell.settingsChanged", { name: "shell.recentCommandCount", value: limit, isSet: true });
    bridge.publishEvent("shell.recentCommandsChanged", { ids: recent });
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function sections(): (string | null)[] {
    return [...root().querySelectorAll("[role=option]")].map(t => t.querySelector(".tr-quick-input-section")?.textContent?.trim() ?? null);
  }

  function separatedIds(): string[] {
    return [...root().querySelectorAll<HTMLElement>(".tr-quick-input-separator + [role=option]")].map(t => t.dataset["item"] ?? "");
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

  it("lists every enabled command and menu row once, by title, without sections while nothing was run, and leaves out a disabled one", () => {
    const rows = [...root().querySelectorAll("[role=option]")].map(t => [t.querySelector(".tr-quick-input-title")?.textContent?.trim(), t.querySelector(".tr-quick-input-detail")?.textContent?.trim()]);

    expect(new Set(ids()).size).toBe(ids().length);
    expect(rows).toEqual([...rows].sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1]))));
    expect(rows.filter(t => t[1] === "weather")).toEqual([["Open the tools", "weather"], ["Photo", "weather"], ["Pluto", "weather"], ["Today's weather", "weather"]]);
    expect(ids()).not.toContain("notes.archive");
    expect([sections().filter(t => t !== null), separatedIds()]).toEqual([[], []]);
  });

  it("lists the recent commands first, newest first and within the limit, then a line and the others by title, labelling the first of each", async () => {
    await showAsync(2, ["weather.pluto", "gone.command", "notes.archive", "notes.newNote", "weather.today"]);

    expect(ids().slice(0, 2)).toEqual(["weather.pluto", "notes.newNote"]);
    expect(ids().filter(t => t === "weather.pluto" || t === "notes.newNote")).toHaveLength(2);
    expect(sections().slice(0, 3)).toEqual([Resources.recentlyUsedSection, null, Resources.otherCommandsSection]);
    expect(sections().slice(3).every(t => t === null)).toBe(true);
    expect(separatedIds()).toEqual([ids()[2]]);
    const others = [...root().querySelectorAll("[role=option]")].slice(2).map(t => t.querySelector(".tr-quick-input-title")?.textContent?.trim() ?? "");
    expect(others).toEqual([...others].sort((a, b) => a.localeCompare(b)));
    expect(root().querySelector("[role=option]")?.textContent).toContain(Resources.recentlyUsedSection);
  });

  it("follows the Recent commands setting, and shows no recent section at 0", async () => {
    await showAsync(5, ["weather.pluto", "notes.newNote", "weather.today"]);
    const five = ids().slice(0, 3);
    await showAsync(1, ["weather.pluto", "notes.newNote", "weather.today"]);
    const one = [ids()[0], sections().filter(t => t !== null)];
    await showAsync(0, ["weather.pluto", "notes.newNote", "weather.today"]);

    expect(five).toEqual(["weather.pluto", "notes.newNote", "weather.today"]);
    expect(one).toEqual(["weather.pluto", [Resources.recentlyUsedSection, Resources.otherCommandsSection]]);
    expect([sections().filter(t => t !== null), separatedIds()]).toEqual([[], []]);
    expect(ids()[0]).not.toBe("weather.pluto");
  });

  it("keeps the rows whose title, or category followed by the title, contains the query as one run, recent ones first, without sections, and marks the run", async () => {
    const marks = (id: string, part: string): readonly (string | null)[] => [...root().querySelectorAll(`[data-item="${id}"] .tr-quick-input-${part} mark`)].map(t => t.textContent);
    await showAsync(5, ["weather.today", "weather.pluto"]);

    await typeAsync("TO");
    const to = [ids().filter(t => t.startsWith("weather.")), marks("weather.tools", "title"), root().querySelector("[data-item=\"weather.tools\"] .tr-quick-input-title")?.textContent];
    const plain = [sections().filter(t => t !== null), separatedIds()];
    await typeAsync("weather p");
    const category = [ids(), marks("weather.photo", "detail"), marks("weather.photo", "title")];
    await typeAsync("nn");

    expect(to).toEqual([["weather.today", "weather.pluto", "weather.tools", "weather.photo"], ["to"], "Open the tools"]);
    expect(plain).toEqual([[], []]);
    expect(category).toEqual([["weather.pluto", "weather.photo"], ["weather"], ["P"]]);
    expect(ids()).toEqual([]);
  });

  it("shows each command's owner and key, naming the shell's commands after the product and an unknown module by its id", () => {
    const detail = (id: string): string | null | undefined => root().querySelector(`[data-item="${id}"] .tr-quick-input-detail`)?.textContent;
    const key = (id: string): string | null | undefined => root().querySelector(`[data-item="${id}"] .tr-quick-input-key`)?.textContent;

    expect([detail("notes.newNote"), detail("shell.showCommands"), detail("weather.today")]).toEqual(["Notes", Resources.productName, "weather"]);
    expect([key("notes.newNote"), key("shell.showCommands"), key("shell.closeTab")]).toEqual(["Ctrl+Alt+N", "Ctrl+Shift+P", undefined]);
  });

  it("runs the chosen command after closing the search, and records it", async () => {
    const close = vi.spyOn(search, "close");
    const row = vi.spyOn(menuBar, "run");
    await typeAsync("new note");

    root().querySelector<HTMLElement>("[data-item='notes.newNote']")?.click();

    await vi.waitFor(() => expect(runs).toEqual(["notes.newNote"]));
    expect(row).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
    expect(TestBed.inject(RecentCommandsService).ids()).toEqual(["notes.newNote"]);
    expect(bridge.requests.filter(t => t[0] === "shell.recordCommand")).toEqual([["shell.recordCommand", { id: "notes.newNote" }]]);
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

  it("runs a chosen menu row with its arguments after closing the search, and records it", async () => {
    const close = vi.spyOn(search, "close");
    const template = menuBar.searchRows().find(t => t.title === "New note")?.id ?? "";
    await typeAsync("new note");

    root().querySelector<HTMLElement>(`[data-item="${template}"]`)?.click();

    await vi.waitFor(() => expect(received).toEqual([{ template: "plan" }]));
    expect(runs).toEqual(["notes.newNote"]);
    expect(close).toHaveBeenCalledOnce();
    expect(TestBed.inject(RecentCommandsService).ids()).toEqual([template]);
  });

  it("closes the search when it is dismissed", () => {
    const close = vi.spyOn(search, "close");

    root().querySelector(".tr-quick-input-field")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

    expect(close).toHaveBeenCalledOnce();
  });
});
