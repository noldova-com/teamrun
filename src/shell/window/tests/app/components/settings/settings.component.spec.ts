/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ErrorHandler, type Signal, type Type, type WritableSignal, computed, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { page, userEvent } from "vitest/browser";

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import type { SettingDefinition } from "@noldova/teamrun-shell-protocol";
import { ClipboardWriter, DefaultTheme, ThemeMode } from "@noldova/teamrun-shell-ui";

import { SettingsComponent } from "../../../../src/app/components/settings/settings.component";
import { GalleryTokens } from "../../../../src/app/models/gallery-tokens";
import { CommandContribution } from "../../../../src/app/models/command-contribution";
import { CommandService } from "../../../../src/app/services/command.service";
import { DesktopBridgeService } from "../../../../src/app/services/desktop-bridge.service";
import { SettingsPageService } from "../../../../src/app/services/settings-page.service";
import { SettingsService } from "../../../../src/app/services/settings.service";
import { Resources } from "../../../../src/resources";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";
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
  let bridge: DesktopBridgeFixture;
  let settings: FakeSettingsService;
  let errors: unknown[];
  let gallery: Type<unknown> | null;

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

  function pageSelect(host: HTMLElement): HTMLButtonElement {
    return host.querySelector(".tr-settings-page-select .tr-select-button") as HTMLButtonElement;
  }

  async function chooseClockAsync(host: HTMLElement): Promise<void> {
    host.style.width = "37rem";
    await page.getByRole("treeitem", { name: "Clock", exact: true }).click();
    fixture.detectChanges();
  }

  function framesAsync(): Promise<void> {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }

  beforeEach(() => {
    bridge = DesktopBridgeFixture.install("linux");
    settings = new FakeSettingsService();
    errors = [];
    gallery = null;
    TestBed.configureTestingModule({
      providers: [
        { provide: GalleryTokens.component, useFactory: () => gallery },
        { provide: ClipboardWriter, useExisting: DesktopBridgeService },
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
  });

  afterEach(async () => {
    await userEvent.keyboard("{Escape}");
    DesktopBridgeFixture.remove();
    AppearanceFixture.reset();
  });

  it("lists the pages, shows Appearance first with its groups and rows, and shows another page when it is chosen", async () => {
    render();
    const appearance = { pages: texts(".tr-tree-label"), current: texts("[aria-selected=true]"), groups: texts(".tr-settings-group-title"), rows: texts(".tr-setting-row-title") };
    const markers = ["shell.mode", "shell.panelSize"].map(t => element().querySelector(`[data-setting='${t}'] .tr-setting-row-marker`) !== null);

    await page.getByRole("treeitem", { name: "Clock" }).click();
    fixture.detectChanges();

    expect(appearance).toEqual({
      pages: ["Appearance", "Notifications", "Keyboard shortcuts", "Clock", "About"], current: ["Appearance"], groups: ["Theme", "Text"], rows: ["Mode", "Interface text size"]
    });
    expect([texts("[aria-selected=true]"), texts(".tr-settings-group-title"), texts(".tr-setting-row-title")]).toEqual([["Clock"], ["Words", "Ticks"], ["Greeting", "Tick step"]]);
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

  it("scrolls its content from the page list to its end edge with a stable gutter, and keeps its column at the reading width", () => {
    const host = render();
    host.style.width = "100rem";
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const box = (selector: string): DOMRect => (host.querySelector(selector) as HTMLElement).getBoundingClientRect();
    const content = host.querySelector(".tr-settings-content") as HTMLElement;

    expect(Math.abs(box(".tr-settings-content").right - host.getBoundingClientRect().right)).toBeLessThan(1);
    expect(getComputedStyle(content).scrollbarGutter).toBe("stable");
    expect(box(".tr-settings-column").width).toBeCloseTo(51.5 * rem, 0);
  });

  it("spans its search field from the page list's start to the end of the column's content, whether or not the column has reached its reading width", () => {
    const host = render();
    const box = (selector: string): DOMRect => (host.querySelector(selector) as HTMLElement).getBoundingClientRect();
    const column = host.querySelector(".tr-settings-column") as HTMLElement;
    const edges = ["100rem", "60rem"].map(width => {
      host.style.width = width;
      const end = box(".tr-settings-column").right - parseFloat(getComputedStyle(column).paddingRight);
      return [Math.round(box(".tr-settings-search-field").left - box(".tr-settings-pages").left), Math.round(box(".tr-settings-search-field").right - end)];
    });

    expect(edges).toEqual([[0, 0], [0, 0]]);
  });

  it("tops its first heading level with the page list's first item on a page, on Keyboard shortcuts and in search results", async () => {
    const host = render();
    host.style.width = "100rem";
    const top = (selector: string): number => (host.querySelector(selector) as HTMLElement).getBoundingClientRect().top;
    const offset = (): number => Math.round(top(".tr-settings-column h2") - top(".tr-settings-pages .tr-tree-row"));
    const offsets = [offset()];
    await page.getByRole("treeitem", { name: "Keyboard shortcuts" }).click();
    fixture.detectChanges();
    offsets.push(offset());
    await searchAsync("greeting");
    offsets.push(offset());

    expect(offsets).toEqual([0, 0, 0]);
  });

  it("starts and ends the shortcuts table's text, actions and row lines at the column's content edges at its reading width, and Reset all beside the explanation", async () => {
    const host = render();
    await page.getByRole("treeitem", { name: "Keyboard shortcuts" }).click();
    fixture.detectChanges();
    const textLeft = (element: Element): number => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect().left;
    };
    const column = host.querySelector(".tr-settings-column") as HTMLElement;
    const heading = host.querySelector(".tr-settings-group-title") as HTMLElement;
    const rows = [...(host.querySelector(".tr-shortcuts-table") as HTMLTableElement).rows];
    const actions = rows.flatMap(t => [...(t.cells[t.cells.length - 1] as HTMLTableCellElement).querySelectorAll("button")].slice(-1));
    const textEnd = (): number => column.getBoundingClientRect().right - parseFloat(getComputedStyle(column).paddingRight);
    const offsets = ["100rem"].map(width => {
      host.style.width = width;
      const start = textLeft(heading);
      const end = textEnd();
      return [
        ...rows.map(t => textLeft(t.cells[0] as HTMLTableCellElement) - start),
        ...rows.map(t => (t.cells[0] as HTMLTableCellElement).getBoundingClientRect().left - start),
        ...rows.map(t => (t.cells[t.cells.length - 1] as HTMLTableCellElement).getBoundingClientRect().right - end),
        ...actions.map(t => t.getBoundingClientRect().right - end)
      ].map(t => Math.round(t));
    });
    host.style.width = "100rem";
    const reset = (host.querySelector(".tr-shortcuts-reset-all") as HTMLElement).getBoundingClientRect().right;

    expect([rows.length > 1, actions.length > 0]).toEqual([true, true]);
    expect(offsets).toEqual(offsets.map(t => t.map(() => 0)));
    expect(Math.round(reset - textEnd())).toBe(0);
    expect(rows.every(t => getComputedStyle(t.cells[0] as HTMLTableCellElement).borderBottomStyle === "solid")).toBe(true);
  });

  for (const owner of ["Clock", "Clockwork Almanac"])
    it(`scrolls its content sideways, under its own scrollbar at the pane's bottom edge, whenever Keyboard shortcuts is wider than the column, with every row's actions within its scroll and the table scrolling nothing itself, at 40rem, 60rem and 100rem with "${owner}" in the From column`, async () => {
      ModuleStatusFixture.report(ModuleStatusFixture.create("clock", owner));
      const host = render(ThemeMode.Light, "30rem");
      host.style.width = "100rem";
      await page.getByRole("treeitem", { name: "Keyboard shortcuts" }).click();
      fixture.detectChanges();
      const content = host.querySelector(".tr-settings-content") as HTMLElement;
      const actions = [...(host.querySelector(".tr-shortcuts-table") as HTMLTableElement).tBodies[0]?.rows ?? []]
        .flatMap(t => [...(t.cells[t.cells.length - 1] as HTMLTableCellElement).querySelectorAll("button")]);
      const views: (readonly [string, boolean, number, number])[] = [];
      for (const width of ["40rem", "60rem", "100rem"]) {
        host.style.width = width;
        content.scrollTo(0, 0);
        await framesAsync();
        const box = content.getBoundingClientRect();
        const reach = box.left + content.scrollWidth;
        const outOfReach = actions.filter(t => t.getBoundingClientRect().left < box.left || t.getBoundingClientRect().right > reach).length;
        views.push([width, content.scrollWidth > content.clientWidth, Math.round(box.bottom - host.getBoundingClientRect().bottom), outOfReach]);
      }

      expect(actions.length).toBeGreaterThan(0);
      expect([getComputedStyle(content).overflowX, getComputedStyle(host.querySelector(".tr-configuration-table-body") as HTMLElement).overflowX]).toEqual(["auto", "visible"]);
      AppearanceFixture.expectLook(getComputedStyle(content, "::-webkit-scrollbar").height, DefaultTheme.theme, "scrollbar-size", "height");
      expect(views).toEqual([
        ["40rem", true, 0, 0],
        ["60rem", owner.includes(" ") || views[1]?.[1] === true, 0, 0],
        ["100rem", false, 0, 0]
      ]);
    });

  it("mirrors its insets right to left, so its scroller meets the left edge and its start inset is on the right", () => {
    const host = render();
    host.dir = "rtl";
    host.style.width = "100rem";
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const box = (selector: string): DOMRect => (host.querySelector(selector) as HTMLElement).getBoundingClientRect();
    const edges = host.getBoundingClientRect();

    expect(Math.abs(box(".tr-settings-content").left - edges.left)).toBeLessThan(1);
    expect(Math.abs(edges.right - box(".tr-settings-pages").right - 1.5 * rem)).toBeLessThan(1);
    expect(Math.abs(edges.right - box(".tr-settings-search").right - 1.5 * rem)).toBeLessThan(1);
  });

  it("moves focus to the page control it now shows when it switches between the page list and the select, and to no control that was not focused", async () => {
    const host = render();
    const field = host.querySelector(".tr-settings-search-field") as HTMLInputElement;
    await chooseClockAsync(host);

    host.style.width = "15rem";
    await vi.waitFor(() => expect(document.activeElement).toBe(pageSelect(host)));
    host.style.width = "37rem";
    await vi.waitFor(() => expect(document.activeElement).toBe(host.querySelector(".tr-tree-row-current")));
    host.style.width = "15rem";
    (document.activeElement as HTMLElement).blur();
    await vi.waitFor(() => expect(document.activeElement).toBe(pageSelect(host)));
    await searchAsync("greeting");
    field.focus();
    host.style.width = "37rem";
    await framesAsync();
    const searching = document.activeElement;
    host.style.width = "15rem";
    await framesAsync();
    pageSelect(host).focus();
    host.style.width = "37rem";
    await vi.waitFor(() => expect(document.activeElement).toBe(host.querySelector(".tr-tree-row")));

    expect(searching).toBe(field);
  });

  it("closes the Settings pages list when it widens while the list is open, moving focus to the current page, and leaves focus that moved elsewhere", async () => {
    const host = render();
    const outside = document.body.appendChild(document.createElement("button"));
    await chooseClockAsync(host);
    host.style.width = "15rem";
    await vi.waitFor(() => expect(document.activeElement).toBe(pageSelect(host)));
    await userEvent.click(pageSelect(host));
    await expect.element(page.getByRole("listbox")).toBeVisible();

    host.style.width = "37rem";
    await vi.waitFor(() => expect(document.querySelector("[role=listbox]")).toBeNull());
    await vi.waitFor(() => expect(document.activeElement).toBe(host.querySelector(".tr-tree-row-current")));
    host.style.width = "15rem";
    await vi.waitFor(() => expect(document.activeElement).toBe(pageSelect(host)));
    await userEvent.click(pageSelect(host));
    await expect.element(page.getByRole("listbox")).toBeVisible();
    await userEvent.click(outside);
    await vi.waitFor(() => expect(document.querySelector("[role=listbox]")).toBeNull());
    host.style.width = "37rem";
    await framesAsync();
    const kept = document.activeElement;
    outside.remove();

    expect(kept).toBe(outside);
  });

  it("reveals the scrollbars of its page list and its content while they are hovered", async () => {
    render();

    for (const area of [".tr-settings-pages", ".tr-settings-content"])
      await AppearanceFixture.expectThumbRevealsOnHoverAsync(element().querySelector(area) as HTMLElement);
  });

  it("sets every page's content between the column's content edges, the Settings content inset from both its ends, at 100rem, 60rem and 40rem beside the page list and below 37rem with the select, sideways only on Keyboard shortcuts: a built-in page's rows, a module's rows, the shortcuts table and the Gallery", async () => {
    gallery = FakeGalleryComponent;
    const host = render();
    const column = host.querySelector(".tr-settings-column") as HTMLElement;
    const wide = "100rem";
    const widths = [wide, "60rem", "40rem", "calc(37rem - 1px)"];
    const content = host.querySelector(".tr-settings-content") as HTMLElement;
    const sideways: boolean[] = [];
    const measure = (selector: string): readonly (readonly number[])[] => {
      const columnBox = column.getBoundingClientRect();
      const box = (host.querySelector(selector) as HTMLElement).getBoundingClientRect();
      return [
        [columnBox.left + parseFloat(getComputedStyle(column).paddingLeft), columnBox.right - parseFloat(getComputedStyle(column).paddingRight)].map(t => Math.round(t)),
        [box.left, box.right].map(t => Math.round(t))
      ];
    };
    const edges = async (title: string, selector: string): Promise<readonly (readonly (readonly number[])[])[]> => {
      host.style.width = wide;
      await page.getByRole("treeitem", { name: title, exact: true }).click();
      fixture.detectChanges();
      return widths.map(t => {
        host.style.width = t;
        if (title !== "Keyboard shortcuts")
          sideways.push(content.scrollWidth > content.clientWidth);
        return measure(selector);
      });
    };
    const shown = [
      await edges("Appearance", "tr-setting-row"),
      await edges("Appearance", ".tr-settings-group-title"),
      await edges("Clock", "tr-setting-row"),
      await edges("Keyboard shortcuts", "tr-shortcuts tr-configuration-table"),
      await edges("Gallery", ".fake-gallery")
    ];
    const lists = widths.map(t => {
      host.style.width = t;
      return [".tr-settings-pages", ".tr-settings-page-select"].map(u => getComputedStyle(host.querySelector(u) as Element).display === "none" ? "hidden" : "shown");
    });
    const insets = widths.map(t => {
      host.style.width = t;
      const end = document.createElement("div");
      end.style.width = "var(--tr-settings-column-end)";
      column.append(end);
      const columnEnd = end.getBoundingClientRect().width;
      end.remove();
      const style = getComputedStyle(column);
      return [style.paddingLeft, `${parseFloat(style.paddingRight) - columnEnd}px`];
    });

    expect(lists).toEqual([["shown", "hidden"], ["shown", "hidden"], ["shown", "hidden"], ["hidden", "shown"]]);
    expect(shown.flat().map(t => t[1])).toEqual(shown.flat().map(t => t[0]));
    expect(sideways.filter(t => t)).toEqual([]);
    for (const inset of insets.flat())
      AppearanceFixture.expectLook(inset, DefaultTheme.theme, "settings-content-inset", "padding-left");
  });

  it("starts each group title, on a page and in search results, where its setting rows' headings start, inside their padding", async () => {
    const host = render();
    const offsets = (heading: string): readonly number[] => [...host.querySelectorAll(".tr-settings-group")].map(t => {
      const title = t.querySelector(heading) as HTMLElement;
      const start = title.getBoundingClientRect().left + parseFloat(getComputedStyle(title).paddingInlineStart);
      return Math.round(start - (t.querySelector(".tr-setting-row-heading") as HTMLElement).getBoundingClientRect().left);
    });

    const appearance = offsets(".tr-settings-group-title");
    await searchAsync("clock");
    const results = offsets(".tr-settings-result-group");

    expect([appearance.length > 1, results.length]).toEqual([true, 2]);
    expect([...appearance, ...results]).toEqual([...appearance, ...results].map(() => 0));
  });

  it("searches only for what its own field holds", async () => {
    render();
    await searchAsync("tick");

    fixture.debugElement.query(By.css(".tr-settings-search-field")).triggerEventHandler("input", { target: document.createElement("div") });
    fixture.detectChanges();

    expect(texts(".tr-settings-result-title")).toEqual(["Keyboard shortcuts", "Clock"]);
  });

  it("shows the Gallery as the last page when the build has one, and leaves it out of a search", async () => {
    gallery = FakeGalleryComponent;
    render();
    const pages = texts(".tr-tree-label");

    await page.getByRole("treeitem", { name: "Gallery", exact: true }).click();
    fixture.detectChanges();
    const shown = [texts(".fake-gallery"), texts("[aria-selected=true]")];
    await searchAsync("tick");

    expect(pages).toEqual(["Appearance", "Notifications", "Keyboard shortcuts", "Clock", "Gallery", "About"]);
    expect(shown).toEqual([["Controls"], ["Gallery"]]);
    expect(texts(".tr-settings-result-title")).toEqual(["Keyboard shortcuts", "Clock"]);
    expect(element().querySelector(".fake-gallery")).toBeNull();
  });

  it("lists every module the runtime reports with notification kinds on Notifications, whatever its parts, each checked while its notifications are on", async () => {
    render();
    await page.getByRole("treeitem", { name: "Notifications", exact: true }).click();
    fixture.detectChanges();
    const row = element().querySelector("[data-setting='shell.mutedModules']") as HTMLElement;
    const boxes = [...row.querySelectorAll<HTMLInputElement>("input[type=checkbox]")].map(t => [t.closest("tr-checkbox")?.querySelector(".tr-checkbox-text")?.textContent?.trim(), t.checked]);

    await page.getByRole("checkbox", { name: "Notes notifications" }).click();

    expect(boxes).toEqual([["Notes notifications", true], ["Reminder notifications", true]]);
    expect(settings.calls).toEqual(["set shell.mutedModules [\"notes\"]"]);
  });

  it("returns to the first page when the chosen page goes away with its module", async () => {
    render();
    await page.getByRole("treeitem", { name: "Clock" }).click();
    fixture.detectChanges();

    settings.definitions.set(SettingsFixture.all.filter(t => t.name.owner !== "clock"));
    fixture.detectChanges();

    expect([texts(".tr-tree-label"), texts(".tr-settings-group-title")]).toEqual([["Appearance", "Notifications", "Keyboard shortcuts", "About"], ["Theme", "Text"]]);
  });

  it("shows every command's owner and key on Keyboard shortcuts, a key another command kept, and the person's bindings as modified", async () => {
    settings.values.update(t => new Map([...t, ["shell.keyBindings", { "shell.closeTab": null }]]));
    render();

    await page.getByRole("treeitem", { name: "Keyboard shortcuts" }).click();
    fixture.detectChanges();
    const rows = [...element().querySelectorAll("tbody tr")].map(t => [t.getAttribute("data-command"), ...[...t.querySelectorAll("td")].map(u => u.textContent?.trim())]);

    expect(texts("th")).toEqual(["Command", "From", "Key", ""]);
    expect(rows.filter(t => t[0]?.startsWith("clock."))).toEqual([
      ["clock.tick", "Tick the clockclock.tick", "Clock", "Ctrl+Alt+T", "Remove"],
      ["clock.stop", "Stop the clockclock.stop", "Clock", "No keyCtrl+Alt+T is taken by Tick the clock", ""]
    ]);
    expect(rows.find(t => t[0] === "shell.openSettings")?.slice(1, 3)).toEqual(["Settings…shell.openSettings", Resources.productName]);
    expect(rows.find(t => t[0] === "shell.closeTab")?.slice(3)).toEqual(["No key", "Reset"]);
    expect(element().querySelector("[data-command='shell.closeTab'] .tr-shortcut-marker")?.getAttribute("aria-label")).toBe("Modified");
  });

  it("finds a command by a part of its id found only there, and underlines that part in the id under its title", async () => {
    render();

    await searchAsync("bu");
    const split = element().querySelector("[data-command='shell.splitTabUp']");

    expect([split?.querySelector(".tr-shortcut-title")?.textContent?.trim(), split?.querySelector(".tr-shortcut-name")?.textContent]).toEqual(["Split the tab up", "shell.splitTabUp"]);
    expect([...split?.querySelectorAll(".tr-shortcut-name mark") ?? []].map(t => t.textContent)).toEqual(["bU"]);
    expect([".tr-shortcut-title", ".tr-shortcut-owner", ".tr-shortcut-key"].map(t => split?.querySelectorAll(`${t} mark`).length)).toEqual([0, 0, 0]);
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
    const current = texts("[aria-selected=true]");
    await page.getByRole("treeitem", { name: "Appearance" }).click();
    fixture.detectChanges();

    expect(hits).toEqual({ pages: ["Keyboard shortcuts", "Clock"], groups: ["Words", "Ticks"], rows: ["Greeting", "Tick step"], marks: 10 });
    expect(empty).toEqual(["No settings match your search."]);
    expect(current).toEqual([]);
    expect([(element().querySelector(".tr-settings-search-field") as HTMLInputElement).value, texts(".tr-settings-result-title")]).toEqual(["", []]);
  });

  it("offers the desktop's spelling languages on the Spelling languages row and says which one checks words when none of the device's languages is offered", async () => {
    bridge.spelling = Promise.resolve({ languages: ["en-US"], fallback: "en-US" });
    settings.definitions.set([...SettingsFixture.all, SettingsFixture.spellCheckLanguages]);
    render();
    await fixture.whenStable();
    fixture.detectChanges();
    const row = element().querySelector("[data-setting='shell.spellCheckLanguages']") as HTMLElement;

    expect([...row.querySelectorAll(".tr-checkbox-text")].map(t => t.textContent?.trim())).toEqual(["English (United States)"]);
    expect(row.querySelector(".tr-setting-row-note")?.textContent).toBe("None of this device's languages has a dictionary here, so words are checked in English (United States).");
  });

  it("notes on the tray icon's row while the desktop shows no tray icons, drops the note once it does, and ignores a report that is not a yes or no", async () => {
    bridge.trayAvailable = Promise.resolve(false);
    settings.definitions.set([...SettingsFixture.all, SettingsFixture.trayIcon]);
    render();
    await fixture.whenStable();
    await searchAsync("tray");
    const note = (): string | null | undefined => element().querySelector("[data-setting='shell.trayIcon'] .tr-setting-row-note")?.textContent;

    const unavailable = note();
    bridge.changeTrayAvailable(true);
    fixture.detectChanges();
    const available = note();
    bridge.changeTrayAvailable(false);
    bridge.changeTrayAvailable("yes");
    fixture.detectChanges();

    expect(unavailable).toBe("This desktop shows no tray icons right now, so the icon appears once it does. On GNOME, turning on the AppIndicator extension adds them.");
    expect(available).toBeUndefined();
    expect(note()).toBe(unavailable);
    expect(element().querySelectorAll(".tr-setting-row-note").length).toBe(1);
  });

  it("reports a failure to read whether the desktop shows tray icons and adds no note for it", async () => {
    const failure = new Error("The desktop did not answer.");
    bridge.trayAvailable = Promise.reject(failure);
    settings.definitions.set([...SettingsFixture.all, SettingsFixture.trayIcon]);
    render();
    await fixture.whenStable();
    await searchAsync("tray");

    expect(errors).toEqual([failure]);
    expect(element().querySelector("[data-setting='shell.trayIcon'] .tr-setting-row-note")).toBeNull();
  });

  it("runs an action's command from its row, stores nothing, and finds the row by its label", async () => {
    const runs: string[] = [];
    settings.definitions.set([...SettingsFixture.all, SettingsFixture.alarms]);
    TestBed.inject(CommandService).setCommands([new CommandContribution("clock.openAlarms", "Open alarms", null, null, async () => {
      runs.push("clock.openAlarms");
      return null;
    })]);
    render();

    await page.getByRole("treeitem", { name: "Clock", exact: true }).click();
    fixture.detectChanges();
    await page.getByRole("button", { name: "Open alarms" }).click();
    await searchAsync("open alarms");

    expect(runs).toEqual(["clock.openAlarms"]);
    expect(settings.calls).toEqual([]);
    expect([texts(".tr-settings-result-title"), texts(".tr-setting-row-title")]).toEqual([["Keyboard shortcuts", "Clock"], ["Alarms"]]);
  });

  it("disables an action while its command is not registered, as for a module that failed", async () => {
    settings.definitions.set([...SettingsFixture.all, SettingsFixture.alarms]);
    render();

    await page.getByRole("treeitem", { name: "Clock", exact: true }).click();
    fixture.detectChanges();

    expect(element().querySelector<HTMLButtonElement>("[data-setting=\"clock.alarms\"] .tr-setting-row-control button")?.disabled).toBe(true);
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

  it("shows About last, with TeamRun's version above its Updates group, finds its setting in a search, and shows the page a command asks for", async () => {
    settings.definitions.set([SettingsFixture.updateChecks, ...SettingsFixture.all]);
    render();
    await fixture.whenStable();
    bridge.publishUpdate({ kind: "UpToDate", version: null, progress: null, checkedAt: null, reason: null, mustMove: false });
    await fixture.whenStable();
    const pages = texts(".tr-tree-label");

    TestBed.inject(SettingsPageService).open("About");
    TestBed.tick();
    await fixture.whenStable();
    const about = [texts("[aria-selected=true]"), texts(".tr-about-title"), texts(".tr-settings-group-title"), texts(".tr-setting-row-title")];
    const requested = TestBed.inject(SettingsPageService).requested();
    await page.getByRole("treeitem", { name: "Clock", exact: true }).click();
    TestBed.inject(SettingsPageService).open("About");
    TestBed.tick();
    await fixture.whenStable();
    const again = texts("[aria-selected=true]");
    await searchAsync("updates");

    expect(pages).toEqual(["Appearance", "Notifications", "Keyboard shortcuts", "Clock", "About"]);
    expect(about).toEqual([["About"], ["TeamRun 1.2.3"], ["Updates"], ["Check for updates"]]);
    expect([requested, again]).toEqual([null, ["About"]]);
    expect([texts(".tr-settings-result-title"), texts(".tr-setting-row-title"), element().querySelector("tr-about")]).toEqual([["Keyboard shortcuts", "About"], ["Check for updates"], null]);
  });

  it("leaves the Updates group out of About and out of a search while the build turns updates off", async () => {
    settings.definitions.set([SettingsFixture.updateChecks, ...SettingsFixture.all]);
    render();
    await fixture.whenStable();

    TestBed.inject(SettingsPageService).open("About");
    TestBed.tick();
    await fixture.whenStable();
    const about = [texts("[aria-selected=true]"), texts(".tr-about-status span"), texts(".tr-settings-group-title"), texts(".tr-setting-row-title")];
    await searchAsync("updates");

    expect(about).toEqual([["About"], ["Updates are turned off in this build."], [], []]);
    expect([texts(".tr-settings-result-title"), texts(".tr-setting-row-title")]).toEqual([["Keyboard shortcuts"], []]);
  });

  it("follows the component table for the page list and headings", () => {
    render();
    const current = getComputedStyle(element().querySelector(".tr-tree-row-current") as Element);
    const heading = getComputedStyle(element().querySelector(".tr-settings-group-title") as Element);

    expect(current.backgroundColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "list.inactiveSelectionBackground"));
    AppearanceFixture.expectLook(current.minHeight, DefaultTheme.theme, "tree-row-height", "min-height");
    AppearanceFixture.expectLook(getComputedStyle(element().querySelector(".tr-settings-pages") as Element).width, DefaultTheme.theme, "settings-pages-width", "width");
    expect(heading.marginTop).toBe("0px");
    AppearanceFixture.expectLook(heading.marginBottom, DefaultTheme.theme, "settings-heading-space", "margin-bottom");
    AppearanceFixture.expectLook(heading.paddingLeft, DefaultTheme.theme, "settings-item-padding", "padding-left", "padding");
    expect(heading.fontWeight).toBe("600");
    expect(heading.fontSize).toBe(`${parseFloat(getComputedStyle(document.body).fontSize) * 2}px`);
    expect(heading.color).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "settings.headerForeground"));
  });
});
