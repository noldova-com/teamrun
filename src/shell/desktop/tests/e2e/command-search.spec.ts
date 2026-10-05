/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import CommandSearchFixture from "./fixtures/command-search.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import WindowModeFixture from "./fixtures/window-mode.fixture.ts";

function pane(window: Page): Locator {
  return window.locator(".cdk-overlay-container .tr-command-search-pane");
}

function field(window: Page): Locator {
  return window.getByRole("combobox", { name: "Search commands" });
}

function options(window: Page): Locator {
  return pane(window).getByRole("option");
}

test.describe("command search", () => {
  test("opens from its key centred under the window row, runs a module's command from the keyboard and lists it first next time @smoke", async ({ desktop }) => {
    const window = desktop.window;
    const tab = window.locator("tr-tab[data-tab-key=\"document/notes.note/2\"]");
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(tab).toBeFocused();

    await window.keyboard.press("ControlOrMeta+Shift+KeyP");

    await expect(field(window)).toBeFocused();
    await expect(field(window)).toHaveAttribute("aria-activedescendant", await options(window).first().getAttribute("id") ?? "");
    const row = await window.locator("tr-window-row").boundingBox();
    const box = await pane(window).boundingBox();
    const width = await window.evaluate(() => document.documentElement.clientWidth);
    expect(Math.abs((box?.y ?? 0) - ((row?.y ?? 0) + (row?.height ?? 0)))).toBeLessThan(1);
    expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - width / 2)).toBeLessThan(1);

    await window.keyboard.type("new n");
    await expect(options(window).last()).toHaveAttribute("data-item", "notes.newNote");
    await expect(options(window).last().locator("mark")).toHaveText(["New n"]);
    await expect(options(window).last().locator(".tr-quick-input-detail")).toHaveText("Notes");
    await window.keyboard.press("End");
    await window.keyboard.press("Enter");

    await expect(pane(window)).toHaveCount(0);
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/3\"] .tr-tab-label")).toHaveText("Note 3");

    await window.keyboard.press("ControlOrMeta+Shift+KeyP");
    await expect(options(window).first()).toHaveAttribute("data-item", "notes.newNote");
    await desktop.checkpointAsync("command-search-open");
  });

  test("selects the query with Shift and Home or End, leaving the list where it is, while Home and End alone move through the list", async ({ desktop }) => {
    const window = desktop.window;
    const selection = (): Promise<[number | null, number | null]> => field(window).evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd]);
    await window.locator("tr-window-row").getByRole("button", { name: "Search commands" }).click();
    await expect(field(window)).toBeFocused();
    await window.keyboard.type("new note");
    await expect(options(window)).toHaveCount(2);
    const first = await options(window).first().getAttribute("id") ?? "";
    const last = await options(window).last().getAttribute("id") ?? "";

    await window.keyboard.press("End");
    await expect(field(window)).toHaveAttribute("aria-activedescendant", last);
    expect(await selection()).toEqual([8, 8]);
    await window.keyboard.press("Shift+Home");
    expect(await selection()).toEqual([0, 8]);
    await expect(field(window)).toHaveAttribute("aria-activedescendant", last);
    await window.keyboard.press("ArrowRight");
    await window.keyboard.press("Shift+End");
    expect(await selection()).toEqual([8, 8]);
    await window.keyboard.press("Home");
    await expect(field(window)).toHaveAttribute("aria-activedescendant", first);
    await window.keyboard.press("Escape");

    await expect(pane(window)).toHaveCount(0);
  });

  test("opens from the top bar, runs a runtime part's command chosen with the pointer, leaves out a disabled command, and returns focus when dismissed", async ({ desktop }) => {
    const window = desktop.window;
    const ticks = window.locator("[data-fixture-content=clock-ticks]");
    const tab = window.locator("tr-tab[data-tab-key=\"document/notes.note/2\"]");
    const button = window.locator("tr-window-row").getByRole("button", { name: "Search commands" });
    await expect(ticks).toHaveText("No ticks");

    await button.click();
    await expect(field(window)).toBeFocused();
    await window.keyboard.type("tick");
    await pane(window).locator("[data-item=\"clock.tick\"]").click();

    await expect(ticks).toHaveText("Ticks: 1");
    await expect(pane(window)).toHaveCount(0);
    await expect(button).toBeFocused();
    await tab.click();
    await expect(tab).toBeFocused();

    await CommandSearchFixture.searchAsync(window, "keep the tab");
    await expect(pane(window).getByRole("status")).toHaveText("No results");
    await expect(options(window)).toHaveCount(0);
    await window.keyboard.press("Escape");

    await expect(pane(window)).toHaveCount(0);
    await expect(tab).toBeFocused();
  });

  test("lists a menu item that passes arguments under its menu, beside the command it runs, and runs it from the pointer", async ({ desktop }) => {
    const window = desktop.window;
    await window.locator("tr-window-row").getByRole("button", { name: "Search commands" }).click();
    await expect(field(window)).toBeFocused();

    await window.keyboard.type("new note");

    await expect(options(window).last().locator("mark")).toHaveText(["New note"]);
    await expect(options(window)).toHaveCount(2);
    await expect(options(window).last()).toHaveAttribute("data-item", "notes.newNote");
    await expect(options(window).first().locator(".tr-quick-input-detail")).toHaveText("File › New from template");
    await expect(options(window).first().locator(".tr-quick-input-key")).toHaveCount(0);
    await desktop.checkpointAsync("command-search-menu-item");
    await options(window).first().click();

    await expect(pane(window)).toHaveCount(0);
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/3\"] .tr-tab-label")).toHaveText("Note 3");
  });

  test("lists each focus command once, leaving out the View menu items that run them without arguments", async ({ desktop }) => {
    const window = desktop.window;
    await CommandSearchFixture.searchAsync(window, "focus");

    await expect(options(window).and(window.locator("[data-item=\"shell.focusNextGroup\"]"))).toHaveCount(1);
    await expect(options(window).and(window.locator("[data-item=\"shell.focusPreviousGroup\"]"))).toHaveCount(1);
    await expect(options(window).and(window.locator("[data-item^=\"shell.view/\"]"))).toHaveCount(0);
  });

  test("a query keeps the rows that contain it as one run, in the same order, and marks the run in the title without changing its text", async ({ desktop }) => {
    const window = desktop.window;
    const rows = (): Promise<readonly (readonly [string, string, string, readonly string[]])[]> => options(window).evaluateAll(items => items.map(item => [
      item.getAttribute("data-item") ?? "",
      item.querySelector(".tr-quick-input-detail")?.textContent ?? "",
      item.querySelector(".tr-quick-input-title")?.textContent ?? "",
      [...item.querySelectorAll("mark")].map(t => t.textContent ?? "")
    ] as const));
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();
    await CommandSearchFixture.searchAsync(window, String());
    await expect(options(window).first()).toBeVisible();
    const all = await rows();
    const expected = all.filter(t => `${t[1]} ${t[2]}`.toLowerCase().includes("tab")).map(t => t[0]);

    await window.keyboard.type("tab");
    await expect.poll(async () => (await rows()).map(t => [t[0], t[3].map(u => u.toLowerCase())])).toEqual(expected.map(t => [t, ["tab"]]));
    const found = await rows();

    expect(found.length).toBeGreaterThan(0);
    expect(found.map(t => [t[1], t[2]])).toEqual(found.map(t => all.find(u => u[0] === t[0])).map(t => [t?.[1], t?.[2]]));
    for (const mode of WindowModeFixture.modes) {
      await WindowModeFixture.setAsync(window, mode);
      await desktop.checkpointAsync(`command-search-match-${mode.toLowerCase()}`);
    }
    await window.keyboard.press("Escape");
  });

  test("keeps its list to half the window's height in a tall window, and to ten rows in a short one", async ({ desktop }) => {
    const window = desktop.window;
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();

    for (const [width, height, name] of [[1920, 1080, "tall"], [900, 420, "short"]] as const) {
      await desktop.useViewportAsync(width, height);
      await CommandSearchFixture.searchAsync(window, String());
      await expect(options(window).first()).toBeVisible();
      const list = await pane(window).locator(".tr-quick-input-list").evaluate(element => ({
        height: element.getBoundingClientRect().height,
        row: (element.querySelector("[role=option]") as HTMLElement).offsetHeight,
        scrolls: element.scrollHeight > element.clientHeight,
        half: innerHeight / 2
      }));

      expect(list.scrolls).toBe(true);
      expect(Math.abs(list.height - (name === "tall" ? list.half : list.row * 10))).toBeLessThan(1);
      expect(list.row * 10 > list.half).toBe(name === "short");
      await desktop.checkpointAsync(`command-search-height-${name}`);
      await window.keyboard.press("Escape");
      await expect(pane(window)).toHaveCount(0);
    }
  });

  test("lists the commands last run from it first, newest first, labelled and set apart from the others, keeps them first while typing, and after a restart", async ({ desktop }) => {
    const ids = (): Promise<readonly string[]> => options(window).evaluateAll(items => items.map(t => t.getAttribute("data-item") ?? ""));
    const sections = (): Promise<readonly (readonly [number, string])[]> => options(window).evaluateAll(items => items.flatMap((t, index) => {
      const label = t.querySelector(".tr-quick-input-section")?.textContent?.trim();
      return label === undefined ? [] : [[index, label] as const];
    }));
    const separated = (): Promise<readonly string[]> => pane(window).locator(".tr-quick-input-separator + [role=option]").evaluateAll(items => items.map(t => t.getAttribute("data-item") ?? ""));
    let window = desktop.window;
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();

    await CommandSearchFixture.searchAsync(window, "new n");
    await expect(options(window).last()).toHaveAttribute("data-item", "notes.newNote");
    await window.keyboard.press("End");
    await window.keyboard.press("Enter");
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/3\"]")).toBeVisible();
    await CommandSearchFixture.searchAsync(window, "tick");
    await pane(window).locator("[data-item=\"clock.tick\"]").click();
    await expect(window.locator("[data-fixture-content=clock-ticks]")).toHaveText("Ticks: 1");

    await CommandSearchFixture.searchAsync(window, String());
    await expect(options(window).first()).toHaveAttribute("data-item", "clock.tick");
    const listed = await ids();
    expect(listed.slice(0, 2)).toEqual(["clock.tick", "notes.newNote"]);
    expect(new Set(listed).size).toBe(listed.length);
    expect(await sections()).toEqual([[0, "recently used"], [2, "other commands"]]);
    expect(await separated()).toEqual([listed[2]]);
    await expect(options(window).first()).toHaveAccessibleName(/recently used$/);
    await expect(options(window).nth(2)).toHaveAccessibleName(/other commands$/);
    const titles = await options(window).evaluateAll(items => items.slice(2).map(t => t.querySelector(".tr-quick-input-title")?.textContent ?? ""));
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
    for (const mode of WindowModeFixture.modes) {
      await WindowModeFixture.setAsync(window, mode);
      await desktop.checkpointAsync(`command-search-recent-${mode.toLowerCase()}`);
    }
    await WindowModeFixture.setAsync(window, "Light");

    await window.keyboard.type("o");
    await expect.poll(async () => (await ids()).length).toBeLessThan(listed.length);
    const typed = await ids();
    const typedTitles = await options(window).evaluateAll(items => items.slice(2).map(t => t.querySelector(".tr-quick-input-title")?.textContent ?? ""));
    expect(typed.slice(0, 2)).toEqual(["clock.tick", "notes.newNote"]);
    expect(typedTitles).toEqual([...typedTitles].sort((a, b) => a.localeCompare(b)));
    expect([await sections(), await separated()]).toEqual([[], []]);
    await desktop.checkpointAsync("command-search-recent-typed");
    await window.keyboard.press("Escape");

    await desktop.restartAsync();
    window = desktop.window;
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();
    await CommandSearchFixture.searchAsync(window, String());
    await expect.poll(async () => (await ids()).slice(0, 2)).toEqual(["clock.tick", "notes.newNote"]);
    expect(await sections()).toEqual([[0, "recently used"], [2, "other commands"]]);
    await window.keyboard.press("Escape");
  });

  test("every result's title starts at the same left edge, with or without an icon", async ({ desktop }) => {
    const window = desktop.window;
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();

    await window.keyboard.press("ControlOrMeta+Shift+KeyP");
    await expect(field(window)).toBeFocused();
    await expect(options(window).first()).toBeVisible();

    const titles = await options(window).evaluateAll(items => items.map(item => ({
      icon: item.querySelector(".tr-quick-input-icon")?.textContent?.trim() ?? "",
      left: item.querySelector(".tr-quick-input-title")?.getBoundingClientRect().left ?? -1,
      iconWidth: item.querySelector(".tr-quick-input-icon")?.getBoundingClientRect().width ?? -1
    })));
    expect(titles.some(t => t.icon !== "")).toBe(true);
    expect(titles.some(t => t.icon === "")).toBe(true);
    expect(new Set(titles.map(t => t.left)).size).toBe(1);
    expect(new Set(titles.map(t => t.iconWidth)).size).toBe(1);
    await desktop.checkpointAsync("command-search-icon-column");
    await window.keyboard.press("Escape");
  });
});
