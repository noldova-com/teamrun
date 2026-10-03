/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

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
    await desktop.useSuiteViewportAsync();
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
  });

  test("opens from the top bar, runs a runtime part's command chosen with the pointer, leaves out a disabled command, and returns focus when dismissed", async ({ desktop }) => {
    const window = desktop.window;
    const ticks = window.locator("[data-fixture-content=clock-ticks]");
    const tab = window.locator("tr-tab[data-tab-key=\"document/notes.note/2\"]");
    await expect(ticks).toHaveText("No ticks");
    await tab.click();
    await expect(tab).toBeFocused();

    await window.locator("tr-window-row").getByRole("button", { name: "Search commands" }).click();
    await expect(field(window)).toBeFocused();
    await window.keyboard.type("tick");
    await pane(window).locator("[data-item=\"clock.tick\"]").click();

    await expect(ticks).toHaveText("Ticks: 1");
    await expect(pane(window)).toHaveCount(0);

    await window.keyboard.press("ControlOrMeta+Shift+KeyP");
    await window.keyboard.type("keep the tab");
    await expect(pane(window).getByRole("status")).toHaveText("No results");
    await expect(options(window)).toHaveCount(0);
    await window.keyboard.press("Escape");

    await expect(pane(window)).toHaveCount(0);
    await expect(tab).toBeFocused();
  });
});
