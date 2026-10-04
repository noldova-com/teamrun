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
import { ModuleState, ModuleStatus, type SettingDefinition } from "@noldova/teamrun-shell-protocol";
import { DefaultTheme, ThemeMode } from "@noldova/teamrun-shell-ui";

import { ModulesComponent } from "../../../../src/app/components/modules/modules.component";
import { CommandContribution } from "../../../../src/app/models/command-contribution";
import { CommandService } from "../../../../src/app/services/command.service";
import { ModuleSelectionService } from "../../../../src/app/services/module-selection.service";
import { SettingsService } from "../../../../src/app/services/settings.service";
import { WindowPartHostService } from "../../../../src/app/services/window-part-host.service";
import { Resources } from "../../../../src/resources";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";
import { SettingsFixture } from "../../../fixtures/settings.fixture";

describe("ModulesComponent", () => {
  const clock = new ModuleStatus("clock", "Clock", "Tells the time.", [], new Map([
    ["commands", ["clock.tick", "clock.gone"]], ["settings", ["clock.tickStep", "clock.oldStep"]], ["views", ["clock.face"]], ["methods", ["clock.time"]]
  ]), ModuleState.Active, null);
  const notes = new ModuleStatus("notes", "Notes", "Keeps notes.", [], new Map([["menus", ["notes.tools"]], ["notifications", ["notes.saved"]]]),
    ModuleState.Failed, "Its runtime part could not be loaded.");
  const alarm = new ModuleStatus("alarm", "Alarm", "Rings at a time.", ["clock", "notes"], new Map(), ModuleState.Blocked, "It depends on notes, which is not active.", "notes");
  let fixture: ComponentFixture<ModulesComponent>;
  let modules: WritableSignal<readonly ModuleStatus[]>;
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
    errors = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: WindowPartHostService, useValue: { modules } },
        { provide: SettingsService, useValue: { definitions: signal<readonly SettingDefinition[]>(SettingsFixture.all), values: signal<ReadonlyMap<string, JsonValue>>(new Map()) } },
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }
      ]
    });
    TestBed.inject(CommandService).setCommands([new CommandContribution("clock.tick", "Tick the clock", null, null, () => Promise.resolve(null))]);
  });

  afterEach(() => {
    DesktopBridgeFixture.remove();
    AppearanceFixture.reset();
  });

  it("lists every module in module order with its name, state, id and description, and shows the first with TeamRun's version", async () => {
    await renderAsync();

    expect(texts(".tr-modules-title")).toEqual(["Modules"]);
    expect(texts(".tr-modules-version")).toEqual([Resources.formatProductVersion("1.2.3")]);
    expect(parts(".tr-modules-row")).toEqual([
      ["Clock", "Active", "clock", "Tells the time."],
      ["Notes", "error", "Failed", "notes", "Keeps notes."],
      ["Alarm", "error", "Blocked", "alarm", "Rings at a time."]
    ]);
    expect(texts("[aria-current=true]")).toEqual([texts(".tr-modules-row")[0]]);
    expect(element().querySelector("nav")?.getAttribute("aria-label")).toBe("Modules");
    expect(texts(".tr-modules-detail-title")).toEqual(["Clock"]);
    expect(element().querySelector(".tr-modules-detail")?.getAttribute("aria-labelledby")).toBe(element().querySelector(".tr-modules-detail-title")?.id);
    expect(texts(".tr-modules-facts:first-of-type dt")).toEqual(["State", "Depends on", "Needed by"]);
    expect([texts(".tr-modules-fact-state"), texts(".tr-modules-fact-dependencies"), texts(".tr-modules-fact-dependents")]).toEqual([["Active"], ["None"], ["Alarm"]]);
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
    expect(texts(".tr-modules-facts:first-of-type dt")).toEqual(["State", "Blocked by", "Depends on", "Needed by"]);
    expect([parts(".tr-modules-fact-state"), texts(".tr-modules-fact-blocker"), texts(".tr-modules-fact-dependencies"), texts(".tr-modules-fact-dependents")])
      .toEqual([[["error", "Blocked", "It depends on notes, which is not active."]], ["Notes"], ["Clock, Notes"], ["None"]]);
    expect([texts(".tr-modules-contributions"), texts(".tr-modules-none")]).toEqual([[], ["None", "No commands, settings, menus, views or notification kinds."]]);
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
      expect(getComputedStyle(link("dependents", "Alarm")).color).toBe(AppearanceFixture.readColor(DefaultTheme.theme, mode, "textLink.foreground"));
      fixture.destroy();
    }
  });

  it("truncates a row's name and id on one line and keeps its description to two lines", async () => {
    modules.set([new ModuleStatus("long", "A module whose name is far too long for the list", "Tells the time. ".repeat(20), [], new Map(), ModuleState.Active, null), clock]);
    await renderAsync();
    const long = row("long");

    const truncating = [".tr-modules-name", ".tr-modules-id"].map(t => long.querySelector(t)?.hasAttribute("data-truncates"));
    const description = getComputedStyle(long.querySelector(".tr-modules-description") as Element);

    expect(truncating).toEqual([true, true]);
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
});
