/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ErrorHandler, type Signal, type Type, type WritableSignal, computed, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { page, userEvent } from "vitest/browser";

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import type { SettingDefinition } from "@noldova/teamrun-shell-protocol";
import { DefaultTheme, ThemeMode } from "@noldova/teamrun-shell-ui";

import { SettingsComponent } from "../../../../src/app/components/settings/settings.component";
import { GalleryTokens } from "../../../../src/app/models/gallery-tokens";
import { CommandContribution } from "../../../../src/app/models/command-contribution";
import { Layout } from "../../../../src/app/models/layout/layout";
import { CommandService } from "../../../../src/app/services/command.service";
import type { LayoutService } from "../../../../src/app/services/layout.service";
import { SettingsService } from "../../../../src/app/services/settings.service";
import { Resources } from "../../../../src/resources";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { ModuleStatusFixture } from "../../../fixtures/module-status.fixture";
import { SettingsFixture } from "../../../fixtures/settings.fixture";

class FakeSettingsService {
  public readonly definitions: WritableSignal<readonly SettingDefinition[]> = signal(SettingsFixture.all);
  public readonly values: WritableSignal<ReadonlyMap<string, JsonValue>> = signal(new Map<string, JsonValue>([["shell.mode", "Dark"], ["shell.panelSize", 13]]));
  public readonly sets: WritableSignal<ReadonlySet<string>> = signal(new Set(["shell.mode"]));
  public readonly calls: string[] = [];
  public failure: Error | null = null;

  public isSet(name: string): Signal<boolean> {
    return computed(() => this.sets().has(name));
  }

  public setAsync(name: string, value: JsonValue): Promise<void> {
    this.calls.push(`set ${name} ${JSON.stringify(value)}`);
    return Object.is(this.failure, null) ? Promise.resolve() : Promise.reject(this.failure);
  }

  public resetAsync(name: string): Promise<void> {
    this.calls.push(`reset ${name}`);
    return Object.is(this.failure, null) ? Promise.resolve() : Promise.reject(this.failure);
  }
}

@Component({ selector: "tr-fake-gallery", template: "<p class=\"fake-gallery\">Controls</p>" })
class FakeGalleryComponent {}

describe("SettingsComponent", () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let settings: FakeSettingsService;
  let errors: unknown[];
  let gallery: Type<unknown> | null;
  let layout: LayoutService;

  function render(mode: ThemeMode = ThemeMode.Light, height: string = String.empty): HTMLElement {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    fixture = TestBed.createComponent(SettingsComponent);
    (fixture.nativeElement as HTMLElement).style.height = height;
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texts = (selector: string): readonly string[] => [...element().querySelectorAll(selector)].map(t => t.textContent?.trim() ?? "");

  async function searchAsync(text: string): Promise<void> {
    const field = element().querySelector<HTMLInputElement>(".tr-settings-search-field") as HTMLInputElement;
    field.value = text;
    field.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    DesktopBridgeFixture.install("linux");
    settings = new FakeSettingsService();
    errors = [];
    gallery = null;
    TestBed.configureTestingModule({
      providers: [
        { provide: GalleryTokens.component, useFactory: () => gallery },
        { provide: SettingsService, useValue: settings },
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }
      ]
    });
    ModuleStatusFixture.report(
      ModuleStatusFixture.create("clock", "Clock"), ModuleStatusFixture.create("notes", "Notes", ["notes.saved"]), ModuleStatusFixture.create("reminder", "Reminder", ["reminder.due"]));
    TestBed.inject(CommandService).setCommands([
      new CommandContribution("clock.tick", "Tick the clock", null, "Ctrl+Alt+T", () => Promise.resolve(null)),
      new CommandContribution("clock.stop", "Stop the clock", null, "Ctrl+Alt+T", () => Promise.resolve(null))
    ]);
    const registry = LayoutFixture.createRegistry();
    layout = await LayoutServiceFixture.prepareAsync(registry, Layout.createDefault(registry).openDocument(LayoutFixture.settings));
  });

  afterEach(async () => {
    await userEvent.keyboard("{Escape}");
    DesktopBridgeFixture.remove();
    AppearanceFixture.reset();
  });

  it("lists the pages, shows Appearance first with its groups and rows, and shows another page when it is chosen", async () => {
    render();
    const appearance = { pages: texts(".tr-settings-page"), current: texts("[aria-current=page]"), groups: texts(".tr-settings-group-title"), rows: texts(".tr-setting-row-title") };
    const markers = ["shell.mode", "shell.panelSize"].map(t => element().querySelector(`[data-setting='${t}'] .tr-setting-row-marker`) !== null);

    await page.getByRole("button", { name: "Clock" }).click();
    fixture.detectChanges();

    expect(appearance).toEqual({
      pages: ["Appearance", "Notifications", "Keyboard shortcuts", "Clock"], current: ["Appearance"], groups: ["Theme", "Text"], rows: ["Mode", "Interface text size"]
    });
    expect([texts("[aria-current=page]"), texts(".tr-settings-group-title"), texts(".tr-setting-row-title")]).toEqual([["Clock"], ["Words", "Ticks"], ["Greeting", "Tick step"]]);
    expect(markers).toEqual([true, false]);
  });

  it("swaps its page list for a Settings pages select at the start of the search row below 34rem inside its padding, and changes page and leaves a search through it", async () => {
    const host = render();
    const select = (): HTMLButtonElement => host.querySelector(".tr-settings-page-select .tr-select-button") as HTMLButtonElement;
    const shown = (): readonly boolean[] => [".tr-settings-pages", ".tr-settings-page-select"].map(t => getComputedStyle(host.querySelector(t) as Element).display !== "none");
    const box = (selector: string): DOMRect => (host.querySelector(selector) as HTMLElement).getBoundingClientRect();
    host.style.width = "37rem";
    const wide = shown();
    host.style.width = "calc(37rem - 1px)";
    const narrow = shown();
    const row = [box(".tr-settings-page-select").top === box(".tr-settings-search-field").top, box(".tr-settings-page-select").left < box(".tr-settings-search-field").left];
    const filled = Math.abs(box(".tr-settings-content").width - (box(".tr-settings-body").width)) < 1;

    await userEvent.click(select());
    await page.getByRole("option", { name: "Clock" }).click();
    fixture.detectChanges();
    const clock = [select().getAttribute("aria-label"), texts(".tr-settings-group-title")];
    await searchAsync("greeting");
    const searching = select().getAttribute("aria-label");
    await userEvent.click(select());
    await page.getByRole("option", { name: "Appearance" }).click();
    fixture.detectChanges();
    host.style.width = "15rem";
    const stacked = box(".tr-settings-page-select").bottom <= box(".tr-settings-search-field").top;

    expect([wide, narrow]).toEqual([[true, false], [false, true]]);
    expect([row, filled]).toEqual([[true, true], true]);
    expect(clock).toEqual(["Settings pages, Clock", ["Words", "Ticks"]]);
    expect(searching).toBe("Settings pages, Search results");
    expect([(host.querySelector(".tr-settings-search-field") as HTMLInputElement).value, select().getAttribute("aria-label"), texts(".tr-settings-group-title")])
      .toEqual(["", "Settings pages, Appearance", ["Theme", "Text"]]);
    expect(stacked).toBe(true);
  });

  it("lists no page and its page select shows none before any settings arrive", () => {
    settings.definitions.set([]);
    const host = render();

    expect([texts(".tr-settings-page"), host.querySelector(".tr-settings-page-select .tr-select-value")?.textContent?.trim()]).toEqual([[], ""]);
  });

  it("reveals the scrollbars of its page list and its content while they are hovered", () => {
    render();

    expect([".tr-settings-pages", ".tr-settings-content"].map(t => element().querySelector(t)?.classList.contains("tr-scroll-reveal"))).toEqual([true, true]);
  });

  it("shows the Gallery as the last page when the build has one, and leaves it out of a search", async () => {
    gallery = FakeGalleryComponent;
    render();
    const pages = texts(".tr-settings-page");

    await page.getByRole("button", { name: "Gallery", exact: true }).click();
    fixture.detectChanges();
    const shown = [texts(".fake-gallery"), texts("[aria-current=page]")];
    await searchAsync("tick");

    expect(pages).toEqual(["Appearance", "Notifications", "Keyboard shortcuts", "Clock", "Gallery"]);
    expect(shown).toEqual([["Controls"], ["Gallery"]]);
    expect(texts(".tr-settings-result-title")).toEqual(["Keyboard shortcuts", "Clock"]);
    expect(element().querySelector(".fake-gallery")).toBeNull();
  });

  it("lists every module the runtime reports with notification kinds on Notifications, whatever its parts, each checked while its notifications are on", async () => {
    render();
    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    fixture.detectChanges();
    const row = element().querySelector("[data-setting='shell.mutedModules']") as HTMLElement;
    const boxes = [...row.querySelectorAll<HTMLInputElement>("input[type=checkbox]")].map(t => [t.closest("tr-checkbox")?.querySelector(".tr-checkbox-text")?.textContent?.trim(), t.checked]);

    await page.getByRole("checkbox", { name: "Notes notifications" }).click();

    expect(boxes).toEqual([["Notes notifications", true], ["Reminder notifications", true]]);
    expect(settings.calls).toEqual(["set shell.mutedModules [\"notes\"]"]);
  });

  it("returns to the first page when the chosen page goes away with its module", async () => {
    render();
    await page.getByRole("button", { name: "Clock" }).click();
    fixture.detectChanges();

    settings.definitions.set(SettingsFixture.all.filter(t => t.name.owner !== "clock"));
    fixture.detectChanges();

    expect([texts(".tr-settings-page"), texts(".tr-settings-group-title")]).toEqual([["Appearance", "Notifications", "Keyboard shortcuts"], ["Theme", "Text"]]);
  });

  it("shows the page and the scroll positions it had when it is created again, as its tab becomes active again", async () => {
    render(ThemeMode.Light, "5rem");
    await page.getByRole("button", { name: "Keyboard shortcuts" }).click();
    fixture.detectChanges();
    const scrollers = (): readonly HTMLElement[] => [".tr-settings-pages", ".tr-settings-content"].map(t => element().querySelector(t) as HTMLElement);
    scrollers().forEach((t, index) => {
      t.scrollTop = 24 + index * 40;
      t.dispatchEvent(new Event("scroll"));
    });
    const left = scrollers().map(t => t.scrollTop);
    fixture.destroy();

    render(ThemeMode.Light, "5rem");
    await fixture.whenStable();

    expect(left.every(t => t > 0)).toBe(true);
    expect([texts("[aria-current=page]"), scrollers().map(t => t.scrollTop)]).toEqual([["Keyboard shortcuts"], left]);
  });

  it("opens on its first page with no search once its tab was closed", async () => {
    render();
    await page.getByRole("button", { name: "Clock" }).click();
    await searchAsync("tick");
    fixture.destroy();

    layout.close(LayoutFixture.settings);
    TestBed.tick();
    layout.openDocument(LayoutFixture.settings);
    render();

    expect([texts("[aria-current=page]"), (element().querySelector(".tr-settings-search-field") as HTMLInputElement).value]).toEqual([["Appearance"], ""]);
  });

  it("shows the search it had when it is created again", async () => {
    render();
    await searchAsync("tick");
    fixture.destroy();

    render();

    expect([(element().querySelector(".tr-settings-search-field") as HTMLInputElement).value, texts(".tr-settings-result-title")]).toEqual(["tick", ["Keyboard shortcuts", "Clock"]]);
  });

  it("shows every command's owner and key on Keyboard shortcuts, a key another command kept, and the person's bindings as modified", async () => {
    settings.values.update(t => new Map([...t, ["shell.keyBindings", { "shell.closeTab": null }]]));
    render();

    await page.getByRole("button", { name: "Keyboard shortcuts" }).click();
    fixture.detectChanges();
    const rows = [...element().querySelectorAll("tbody tr")].map(t => [t.getAttribute("data-command"), ...[...t.querySelectorAll("td")].map(u => u.textContent?.trim())]);

    expect(texts("th")).toEqual(["Command", "From", "Key", ""]);
    expect(rows.filter(t => t[0]?.startsWith("clock."))).toEqual([
      ["clock.tick", "Tick the clock", "Clock", "Ctrl+Alt+T", "Remove"],
      ["clock.stop", "Stop the clock", "Clock", "No keyCtrl+Alt+T is taken by Tick the clock", ""]
    ]);
    expect(rows.find(t => t[0] === "shell.openSettings")?.slice(1, 3)).toEqual(["Settings…", Resources.productName]);
    expect(rows.find(t => t[0] === "shell.closeTab")?.slice(3)).toEqual(["No key", "Reset"]);
    expect(element().querySelector("[data-command='shell.closeTab'] .tr-shortcut-marker")?.getAttribute("aria-label")).toBe("Modified");
  });

  it("finds commands by their owner", async () => {
    render();

    await searchAsync(Resources.productName);
    const found = [...element().querySelectorAll("tbody tr")].map(t => String(t.getAttribute("data-command")));

    expect(found.length).toBeGreaterThan(0);
    expect(found.every(t => t.startsWith("shell."))).toBe(true);
  });

  it("searches every page by title, description and name, grouping the hits by page and marking them, and leaves the search when a page is chosen", async () => {
    render();

    await searchAsync("clock");
    const hits = { pages: texts(".tr-settings-result-title"), groups: texts(".tr-settings-result-group"), rows: texts(".tr-setting-row-title"), marks: texts("mark").length };
    await searchAsync("nothing like this");
    const empty = texts(".tr-settings-empty");
    await searchAsync("size");
    const current = texts("[aria-current=page]");
    await page.getByRole("button", { name: "Appearance" }).click();
    fixture.detectChanges();

    expect(hits).toEqual({ pages: ["Keyboard shortcuts", "Clock"], groups: ["Words", "Ticks"], rows: ["Greeting", "Tick step"], marks: 8 });
    expect(empty).toEqual(["No settings match your search."]);
    expect(current).toEqual([]);
    expect([(element().querySelector(".tr-settings-search-field") as HTMLInputElement).value, texts(".tr-settings-result-title")]).toEqual(["", []]);
  });

  it("changes and resets a setting through the settings service, and reports a change or reset that fails", async () => {
    render();

    await page.getByRole("button", { name: "Reset Mode" }).click();
    settings.failure = new Error("The runtime refused the value.");
    const size = element().querySelector<HTMLInputElement>("[data-setting='shell.panelSize'] input") as HTMLInputElement;
    size.value = "15";
    size.dispatchEvent(new Event("change"));
    await page.getByRole("button", { name: "Reset Mode" }).click();
    await expect.poll(() => errors.length).toBe(2);

    expect(settings.calls).toEqual(["reset shell.mode", "set shell.panelSize 15", "reset shell.mode"]);
    expect(errors.map(t => (t as Error).message)).toEqual(["The runtime refused the value.", "The runtime refused the value."]);
  });

  it("follows the component table for the page list and headings", () => {
    render();
    const current = getComputedStyle(element().querySelector(".tr-settings-page-current") as Element);
    const heading = getComputedStyle(element().querySelector(".tr-settings-group-title") as Element);

    expect(current.backgroundColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "list.inactiveSelectionBackground"));
    AppearanceFixture.expectLook(current.minHeight, DefaultTheme.theme, "tree-row-height", "min-height");
    AppearanceFixture.expectLook(getComputedStyle(element().querySelector(".tr-settings-pages") as Element).width, DefaultTheme.theme, "settings-pages-width", "width");
    AppearanceFixture.expectLook(heading.marginTop, DefaultTheme.theme, "settings-heading-space", "margin-top");
    AppearanceFixture.expectLook(heading.paddingLeft, DefaultTheme.theme, "settings-heading-inset", "padding-left");
    expect(heading.fontWeight).toBe("600");
    expect(heading.fontSize).toBe(`${parseFloat(getComputedStyle(document.body).fontSize) * 2}px`);
    expect(heading.color).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "settings.headerForeground"));
  });
});
