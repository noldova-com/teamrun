/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, type WritableSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { ModuleState, ModuleStatus, ProgramStatus, type SettingDefinition } from "@noldova/teamrun-shell-protocol";
import { DefaultTheme, ThemeMode } from "@noldova/teamrun-shell-ui";

import { ModulesComponent } from "../../../../src/app/components/modules/modules.component";
import { CommandContribution } from "../../../../src/app/models/command-contribution";
import { WindowPartTokens } from "../../../../src/app/models/window-part-tokens";
import { CommandService } from "../../../../src/app/services/command.service";
import { ModuleSelectionService } from "../../../../src/app/services/module-selection.service";
import { ModuleStatusService } from "../../../../src/app/services/module-status.service";
import { ProgramStatusService } from "../../../../src/app/services/program-status.service";
import { SettingsService } from "../../../../src/app/services/settings.service";
import { Resources } from "../../../../src/resources";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";
import { SettingsFixture } from "../../../fixtures/settings.fixture";
import { TooltipFixture } from "../../../fixtures/tooltip.fixture";

describe("ModulesComponent", () => {
  const clock = new ModuleStatus("clock", "1.4.2", "Clock", "Tells the time.", [], new Map([
    ["commands", ["clock.tick", "clock.gone"]], ["settings", ["clock.tickStep", "clock.oldStep"]], ["views", ["clock.face"]], ["methods", ["clock.time"]]
  ]), ModuleState.Active, null);
  const notes = new ModuleStatus("notes", "0.0.1", "Notes", "Keeps notes.", [], new Map([["menus", ["notes.tools"]], ["notifications", ["notes.saved"]]]),
    ModuleState.Failed, "Its runtime part could not be loaded.");
  const alarm = new ModuleStatus("alarm", "0.0.1", "Alarm", "Rings at a time.", ["clock", "notes"], new Map(), ModuleState.Blocked, "It depends on notes, which is not active.", "notes");
  let fixture: ComponentFixture<ModulesComponent>;
  let modules: WritableSignal<readonly ModuleStatus[]>;
  let programs: WritableSignal<readonly ProgramStatus[]>;
  let isShown: WritableSignal<boolean>;
  let bridge: DesktopBridgeFixture;
  let errors: unknown[];

  async function renderAsync(mode: ThemeMode = ThemeMode.Light): Promise<HTMLElement> {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    fixture = TestBed.createComponent(ModulesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texts = (selector: string): readonly string[] => [...element().querySelectorAll(selector)].map(t => t.textContent?.replace(/\s+/gu, " ").trim() ?? "");
  const parts = (selector: string): readonly (readonly string[])[] => [...element().querySelectorAll(selector)].map(t => {
    const walker = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
    const found: string[] = [];
    while (!Object.isNull(walker.nextNode())) {
      const text = walker.currentNode.textContent?.trim() ?? "";
      if (text.length > 0)
        found.push(text);
    }
    return found;
  });
  const row = (id: string): HTMLButtonElement => element().querySelector(`.tr-modules-row[data-module='${id}']`) as HTMLButtonElement;
  const link = (fact: string, name: string): HTMLButtonElement =>
    [...element().querySelectorAll<HTMLButtonElement>(`.tr-modules-fact-${fact} .tr-modules-link`)].find(t => t.textContent?.trim() === name) as HTMLButtonElement;

  function click(button: HTMLButtonElement): void {
    button.click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    bridge = DesktopBridgeFixture.install("linux");
    modules = signal([clock, notes, alarm]);
    programs = signal([]);
    isShown = signal(true);
    errors = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: ModuleStatusService, useValue: { modules } },
        { provide: WindowPartTokens.shown, useValue: isShown },
        { provide: ProgramStatusService, useValue: { ofModule: (id: string) => programs().filter(t => t.moduleId === id) } },
        { provide: SettingsService, useValue: { definitions: signal<readonly SettingDefinition[]>(SettingsFixture.all), values: signal<ReadonlyMap<string, JsonValue>>(new Map()) } },
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }
      ]
    });
    TestBed.inject(CommandService).setCommands([new CommandContribution("clock.tick", "Tick the clock", null, null, () => Promise.resolve(null))]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    DesktopBridgeFixture.remove();
    AppearanceFixture.reset();
  });

  it("lists every module in module order with its name, state, id, version and description, and shows the first with TeamRun's version", async () => {
    await renderAsync();

    expect(texts(".tr-modules-title")).toEqual(["Modules"]);
    expect(texts(".tr-modules-version")).toEqual([Resources.formatProductVersion("1.2.3")]);
    expect(parts(".tr-modules-row")).toEqual([
      ["Clock", "Active", "clock", "1.4.2", "Tells the time."],
      ["Notes", "error", "Failed", "notes", "0.0.1", "Keeps notes."],
      ["Alarm", "error", "Blocked", "alarm", "0.0.1", "Rings at a time."]
    ]);
    expect(texts("[aria-current=true]")).toEqual([texts(".tr-modules-row")[0]]);
    expect(element().querySelector("nav")?.getAttribute("aria-label")).toBe("Modules");
    expect(texts(".tr-modules-detail-title")).toEqual(["Clock"]);
    expect(element().querySelector(".tr-modules-detail")?.getAttribute("aria-labelledby")).toBe(element().querySelector(".tr-modules-detail-title")?.id);
    expect(texts(".tr-modules-facts:first-of-type dt")).toEqual(["Version", "State", "Depends on", "Needed by"]);
    expect([texts(".tr-modules-fact-version"), texts(".tr-modules-fact-state"), texts(".tr-modules-fact-dependencies"), texts(".tr-modules-fact-dependents")]).toEqual([["1.4.2"], ["Active"], ["None"], ["Alarm"]]);
    expect([...element().querySelectorAll(".tr-modules-contributions")].map(t => t.getAttribute("data-kind"))).toEqual(["commands", "settings", "views"]);
    expect(parts(".tr-modules-contribution")).toEqual([["Tick the clock", "clock.tick"], ["clock.gone"], ["Tick step", "clock.tickStep"], ["clock.oldStep"], ["clock.face"]]);
    expect(errors).toEqual([]);
  });

  it("shows a failed or blocked module's cause, its blocker and dependencies as links, and nothing it contributes when it has none", async () => {
    await renderAsync();

    click(row("notes"));
    const failed = [parts(".tr-modules-fact-state"), texts(".tr-modules-fact-dependents"), texts(".tr-modules-contribution")];
    click(row("alarm"));

    expect(failed).toEqual([[["error", "Failed", "Its runtime part could not be loaded."]], ["Alarm"], ["notes.tools", "notes.saved"]]);
    expect(texts("[aria-current=true] .tr-modules-name")).toEqual(["Alarm"]);
    expect(texts(".tr-modules-facts:first-of-type dt")).toEqual(["Version", "State", "Blocked by", "Depends on", "Needed by"]);
    expect([parts(".tr-modules-fact-state"), texts(".tr-modules-fact-blocker"), texts(".tr-modules-fact-dependencies"), texts(".tr-modules-fact-dependents")])
      .toEqual([[["error", "Blocked", "It depends on notes, which is not active."]], ["Notes"], ["Clock, Notes"], ["None"]]);
    expect([texts(".tr-modules-contributions"), texts(".tr-modules-none")]).toEqual([[], ["None", "No programs are running.", "No commands, settings, menus, views or notification kinds."]]);
  });

  it("lists the selected module's running programs, counts them in the list rows and says how long each has run, each minute", async () => {
    const started = new Date("2026-10-06T08:00:00.000Z");
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(started.getTime() + 3 * 60_000 + 30_000);
    programs.set([
      new ProgramStatus("clock", "/usr/bin/node", 4210, started, false),
      new ProgramStatus("notes", "C:\\Tools\\sync.exe", 4300, started, false),
      new ProgramStatus("clock", "/opt/clock/helper", 4211, started, true)
    ]);
    await renderAsync();

    const rows = texts(".tr-modules-row-programs");
    const shown = parts(".tr-modules-program");
    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();
    const minuteLater = texts(".tr-modules-program-state");
    click(row("notes"));
    const notesShown = parts(".tr-modules-program");
    programs.set([]);
    fixture.detectChanges();

    expect(rows).toEqual(["2 programs", "1 program"]);
    expect(shown).toEqual([["node", "Running for 3 min", "/usr/bin/node", "Process 4210"], ["helper", "Exited, its processes still run", "/opt/clock/helper", "Process 4211"]]);
    expect(minuteLater).toEqual(["Running for 4 min", "Exited, its processes still run"]);
    expect(notesShown).toEqual([["sync.exe", "Running for 4 min", "C:\\Tools\\sync.exe", "Process 4300"]]);
    expect([texts(".tr-modules-programs"), texts(".tr-modules-row-programs"), texts(".tr-modules-section-title")])
      .toEqual([[], [], ["Running programs", "Contributes"]]);
    expect(texts(".tr-modules-none")).toContain("No programs are running.");
  });

  it("keeps no minute clock while its page is hidden, and shows the running time again as soon as it is shown", async () => {
    const started = new Date("2026-10-06T08:00:00.000Z");
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(started.getTime() + 3 * 60_000);
    programs.set([new ProgramStatus("clock", "/usr/bin/node", 4210, started, false)]);
    await renderAsync();
    const shownTimers = vi.getTimerCount();

    isShown.set(false);
    fixture.detectChanges();
    const hiddenTimers = vi.getTimerCount();
    vi.advanceTimersByTime(5 * 60_000);
    fixture.detectChanges();
    const hidden = texts(".tr-modules-program-state");
    isShown.set(true);
    fixture.detectChanges();

    expect([shownTimers, hiddenTimers, vi.getTimerCount()]).toEqual([1, 0, 1]);
    expect(hidden).toEqual(["Running for 3 min"]);
    expect(texts(".tr-modules-program-state")).toEqual(["Running for 8 min"]);
  });

  it("gives a program's start in a tooltip, keeps its name and path on one line with their full text in a tooltip while cut short, and stops its minute clock when it closes", async () => {
    const started = new Date("2026-10-06T08:00:00.000Z");
    programs.set([new ProgramStatus("clock", `/opt/${"far/".repeat(40)}node`, 4210, started, false)]);
    const clear = vi.spyOn(globalThis, "clearInterval");
    await renderAsync();
    const program = element().querySelector(".tr-modules-program") as HTMLElement;

    const truncating = [".tr-modules-program-name", ".tr-modules-program-path"].map(t => program.querySelector(t)?.hasAttribute("data-truncates"));
    const meta = getComputedStyle(program.querySelector(".tr-modules-program-meta") as Element);
    const layout = [meta.display, meta.minWidth, getComputedStyle(program.querySelector(".tr-modules-program-process") as Element).flexShrink];
    await TooltipFixture.expectTooltipAsync(program.querySelector(".tr-modules-program-state") as HTMLElement,
      `Started ${new Intl.DateTimeFormat(undefined, Resources.programStartFormat).format(started)}`);
    fixture.destroy();

    expect(truncating).toEqual([true, true]);
    expect(layout).toEqual(["flex", "0px", "0"]);
    expect(clear).toHaveBeenCalled();
  });

  it("names a dependency or blocker the list lacks by its id, without a link", async () => {
    modules.set([clock, alarm]);
    TestBed.inject(ModuleSelectionService).select("alarm");

    await renderAsync();

    expect([texts(".tr-modules-fact-blocker"), texts(".tr-modules-fact-dependencies")]).toEqual([["notes"], ["Clock, notes"]]);
    expect([texts(".tr-modules-fact-dependencies .tr-modules-link"), texts(".tr-modules-unknown")]).toEqual([["Clock"], ["notes", "notes"]]);
  });

  it("follows a link to its module, selecting it and moving the focus to its row", async () => {
    await renderAsync();
    click(row("alarm"));

    click(link("blocker", "Notes"));
    await fixture.whenStable();
    const blocker = [texts(".tr-modules-detail-title"), document.activeElement === row("notes")];
    click(link("dependents", "Alarm"));
    click(link("dependencies", "Clock"));
    await fixture.whenStable();

    expect(blocker).toEqual([["Notes"], true]);
    expect(texts(".tr-modules-detail-title")).toEqual(["Clock"]);
    expect(document.activeElement).toBe(row("clock"));
  });

  it("follows the modules while open, keeping the selected module while it remains and else showing the first", async () => {
    await renderAsync();
    click(row("alarm"));

    modules.set([notes, alarm.withState(ModuleState.Active, null)]);
    fixture.detectChanges();
    const kept = [texts(".tr-modules-detail-title"), texts(".tr-modules-fact-state")];
    modules.set([notes, clock]);
    fixture.detectChanges();

    expect(kept).toEqual([["Alarm"], ["Active"]]);
    expect([texts(".tr-modules-row .tr-modules-name"), texts(".tr-modules-detail-title")]).toEqual([["Notes", "Clock"], ["Notes"]]);
  });

  it("offers to copy the details and open the log folder for a module that isn't active only", async () => {
    await renderAsync();
    const active = element().querySelectorAll("tr-module-actions").length;

    click(row("notes"));

    expect(active).toBe(0);
    expect(parts(".tr-modules-detail tr-module-actions button")).toEqual([["content_copy", "Copy details"], ["folder_open", "Open log folder"]]);
  });

  it("shows the module the selection names, as when the status bar opens the document on a failed module", async () => {
    TestBed.inject(ModuleSelectionService).select("alarm");

    await renderAsync();

    expect([texts("[aria-current=true] .tr-modules-name"), texts(".tr-modules-detail-title")]).toEqual([["Alarm"], ["Alarm"]]);
  });

  it("says when the build has no modules, and reports a build it cannot read without showing a version", async () => {
    modules.set([]);
    bridge.build = null;

    await renderAsync();

    expect([texts(".tr-modules-empty"), texts(".tr-modules-detail"), texts(".tr-modules-version")]).toEqual([["No modules"], [], []]);
    expect(errors.length).toBe(1);
  });

  it("follows the component table for the list, rows, states and links in both modes", async () => {
    for (const mode of AppearanceFixture.modes) {
      const host = await renderAsync(mode);
      const current = getComputedStyle(row("clock"));
      const title = getComputedStyle(host.querySelector(".tr-modules-title") as Element);

      AppearanceFixture.expectLook(getComputedStyle(host.querySelector(".tr-modules-list") as Element).flexBasis, DefaultTheme.theme, "modules-list-width", "flex-basis");
      AppearanceFixture.expectLook(getComputedStyle(host.querySelector(".tr-modules-detail") as Element).maxWidth, DefaultTheme.theme, "modules-detail-width", "max-width");
      expect(current.backgroundColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, mode, "list.inactiveSelectionBackground"));
      expect([title.fontWeight, title.color]).toEqual(["600", AppearanceFixture.readColor(DefaultTheme.theme, mode, "settings.headerForeground")]);
      expect(getComputedStyle(host.querySelector(".tr-modules-state-icon") as Element).color).toBe(AppearanceFixture.readColor(DefaultTheme.theme, mode, "errorForeground"));
      expect(getComputedStyle(host.querySelector(".tr-modules-row-version") as Element).color).toBe(AppearanceFixture.readColor(DefaultTheme.theme, mode, "foreground"));
      expect(getComputedStyle(link("dependents", "Alarm")).color).toBe(AppearanceFixture.readColor(DefaultTheme.theme, mode, "textLink.foreground"));
      fixture.destroy();
    }
  });

  it("truncates a row's name and id on one line, keeps its version whole beside the id and its description to two lines", async () => {
    modules.set([new ModuleStatus("long", "0.0.1", "A module whose name is far too long for the list", "Tells the time. ".repeat(20), [], new Map(), ModuleState.Active, null), clock]);
    await renderAsync();
    const long = row("long");

    const truncating = [".tr-modules-name", ".tr-modules-id"].map(t => long.querySelector(t)?.hasAttribute("data-truncates"));
    const description = getComputedStyle(long.querySelector(".tr-modules-description") as Element);
    const meta = getComputedStyle(long.querySelector(".tr-modules-row-meta") as Element);
    const version = getComputedStyle(long.querySelector(".tr-modules-row-version") as Element);

    expect(truncating).toEqual([true, true]);
    expect([meta.display, meta.minWidth, version.flexShrink]).toEqual(["flex", "0px", "0"]);
    expect([description.webkitLineClamp, description.overflow]).toEqual(["2", "hidden"]);
    expect(long.querySelector(".tr-modules-description")?.textContent).toBe("Tells the time. ".repeat(20));
  });

  it("makes the module's name the largest text in its details and shows its state at panel size there, smaller in the list", async () => {
    const host = await renderAsync();
    const size = (selector: string): number => Number.parseFloat(getComputedStyle(host.querySelector(selector) as Element).fontSize);

    expect(size(".tr-modules-detail-title")).toBeGreaterThan(size(".tr-modules-detail-description"));
    expect(size(".tr-modules-fact-state .tr-modules-state")).toBe(size(".tr-modules-fact-dependencies"));
    expect(size(".tr-modules-row .tr-modules-state")).toBeLessThan(size(".tr-modules-fact-state .tr-modules-state"));
  });

  it("sizes the module's name in its details from the panel size, even when the message size is smaller", async () => {
    const host = await renderAsync();
    AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light, 16);
    document.documentElement.style.setProperty("--tr-text-message", "12px");
    const size = (selector: string): number => Number.parseFloat(getComputedStyle(host.querySelector(selector) as Element).fontSize);

    expect(size(".tr-modules-detail-title")).toBeGreaterThan(size(".tr-modules-detail-description"));
    AppearanceFixture.expectRem(getComputedStyle(host.querySelector(".tr-modules-detail-title") as Element).fontSize, 0.8125 + 0.125, 16);
  });
});
