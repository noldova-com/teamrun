/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { CommandSearchComponent } from "../../../../src/app/components/command-search/command-search.component";
import { CommandContribution } from "../../../../src/app/models/command-contribution";
import { WindowPartSource } from "../../../../src/app/models/window-part-source";
import { WindowPartTokens } from "../../../../src/app/models/window-part-tokens";
import { CommandSearchService } from "../../../../src/app/services/command-search.service";
import { CommandService } from "../../../../src/app/services/command.service";
import { Resources } from "../../../../src/resources";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";

describe("CommandSearchComponent", () => {
  let fixture: ComponentFixture<CommandSearchComponent>;
  let commands: CommandService;
  let search: CommandSearchService;
  let runs: string[];

  const command = (name: string, title: string, key: string | null = null, isEnabled: boolean = true): CommandContribution =>
    new CommandContribution(name, title, null, key, async () => {
      runs.push(name);
      return null;
    }, () => isEnabled);

  beforeEach(async () => {
    runs = [];
    DesktopBridgeFixture.install("win32");
    TestBed.configureTestingModule({
      providers: [{ provide: WindowPartTokens.sources, useValue: [new WindowPartSource("notes", "Notes", [], [], ["notes.newNote"], [], [], [], () => Promise.reject(new Error("Not loaded.")))] }]
    });
    commands = TestBed.inject(CommandService);
    search = TestBed.inject(CommandSearchService);
    commands.setCommands([
      command("notes.newNote", "New note", "Mod+Alt+N"), command("notes.archive", "Archive the note", null, false), command("weather.today", "Today's weather"), command("weather.tools", "Open the tools"), command("weather.pluto", "Pluto"), command("weather.photo", "Photo")
    ]);
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

  it("lists every enabled command alphabetically by title, with the ones run this session first, and leaves out a disabled one", async () => {
    const titles = commands.commands().filter(t => t.isEnabled(null)).map(t => t.title).sort((a, b) => a.localeCompare(b));
    expect(ids()).toEqual(titles.map(t => commands.commands().find(u => u.title === t)?.name));
    expect(ids()).not.toContain("notes.archive");

    search.remember("weather.today");
    search.remember("notes.newNote");
    fixture.detectChanges();
    await fixture.whenStable();

    expect(ids().slice(0, 2)).toEqual(["notes.newNote", "weather.today"]);
  });

  it("filters by the query, ranking prefix matches, then word starts, then letters anywhere, and shorter titles first within each", async () => {
    await typeAsync("to");

    expect(ids().filter(t => t.startsWith("weather."))).toEqual(["weather.today", "weather.tools", "weather.photo", "weather.pluto"]);
    await typeAsync("nn");
    expect(ids()).toEqual(["notes.newNote"]);
    await typeAsync("zzz");
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
    await typeAsync("new note");

    root().querySelector<HTMLElement>("[data-item='notes.newNote']")?.click();

    await vi.waitFor(() => expect(runs).toEqual(["notes.newNote"]));
    expect(close).toHaveBeenCalledOnce();
    expect(search.recent()).toEqual(["notes.newNote"]);
  });

  it("closes the search when it is dismissed", () => {
    const close = vi.spyOn(search, "close");

    root().querySelector(".tr-quick-input-field")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

    expect(close).toHaveBeenCalledOnce();
  });
});
