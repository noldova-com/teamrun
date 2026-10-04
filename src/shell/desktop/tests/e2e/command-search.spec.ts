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
  test("opens from its key centred under the window row, runs a module's command from the keyboard and lists it first next time", async ({ desktop }) => {
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
    await expect(options(window).first()).toHaveAttribute("data-item", "notes.newNote");
    await expect(options(window).first().locator("mark")).toHaveText(["New n"]);
    await expect(options(window).first().locator(".tr-quick-input-detail")).toHaveText("Notes");
    await window.keyboard.press("Enter");

    await expect(pane(window)).toHaveCount(0);
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/3\"] .tr-tab-label")).toHaveText("Note 3");

    await window.keyboard.press("ControlOrMeta+Shift+KeyP");
    await expect(options(window).first()).toHaveAttribute("data-item", "notes.newNote");
    await desktop.checkpointAsync("command-search-open");
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

  test("lists a menu item that passes arguments after its menu, beside the command it runs, and runs it from the pointer", async ({ desktop }) => {
    const window = desktop.window;
    await window.locator("tr-window-row").getByRole("button", { name: "Search commands" }).click();
    await expect(field(window)).toBeFocused();

    await window.keyboard.type("new note");

    await expect(options(window)).toHaveCount(2);
    await expect(options(window).first()).toHaveAttribute("data-item", "notes.newNote");
    await expect(options(window).last().locator(".tr-quick-input-detail")).toHaveText("File › New from template");
    await expect(options(window).last().locator(".tr-quick-input-key")).toHaveCount(0);
    await desktop.checkpointAsync("command-search-menu-item");
    await options(window).last().click();

    await expect(pane(window)).toHaveCount(0);
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/3\"] .tr-tab-label")).toHaveText("Note 3");
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
