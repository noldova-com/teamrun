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

async function setMenuBarAsync(window: Page, value: string): Promise<void> {
  await window.evaluate(value => (Reflect.get(globalThis, "teamrun") as { request(method: string, payload: unknown): Promise<unknown> })
    .request("shell.setSetting", { name: "shell.menuBar", value }), value);
}

function bar(window: Page): Locator {
  return window.locator("tr-menu-bar");
}

function menuItem(window: Page, title: string): Locator {
  return bar(window).getByRole("menuitem", { name: title });
}

function button(window: Page): Locator {
  return window.locator(".tr-window-row-menu");
}

test.describe("the window row's menus on Windows and Linux", () => {
  test.skip(process.platform === "darwin", "macOS shows the menus in its own menu bar.");

  test.beforeEach(async ({ desktop }) => {
    await expect(desktop.window.locator("tr-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();
  });

  test("inline, the menus are a menu bar at the row's start with the start actions after it, moved by the arrow keys", async ({ desktop }) => {
    const window = desktop.window;
    const back = window.locator(".tr-window-row-start button[data-tr-item=\"notes.back\"]");
    const compose = window.locator(".tr-window-row-actions button[data-tr-item=\"notes.compose\"]");

    await expect(bar(window)).toHaveAttribute("role", "menubar");
    await expect(bar(window).getByRole("menuitem")).toHaveText([/File/, /Edit/, /View/, /Notes/]);
    await expect(button(window)).toHaveCount(0);
    await expect(back).toHaveAttribute("aria-label", "Back");
    const [menus, start, end, row] = await Promise.all([bar(window).boundingBox(), back.boundingBox(), compose.boundingBox(), window.locator("tr-window-row").boundingBox()]);
    expect(menus?.x).toBeLessThan(start?.x ?? 0);
    expect((menus?.x ?? 0) + (menus?.width ?? 0)).toBeLessThanOrEqual(start?.x ?? 0);
    expect((start?.x ?? 0) + (start?.width ?? 0)).toBeLessThan(end?.x ?? 0);
    expect([menus?.y, menus?.height].every(t => (t ?? Infinity) <= (row?.height ?? 0))).toBe(true);
    await desktop.checkpointAsync("menu-bar-inline");

    await menuItem(window, "File").focus();
    await window.keyboard.press("ArrowRight");
    await expect(menuItem(window, "Edit")).toBeFocused();
    await window.keyboard.press("ArrowDown");
    await expect(window.locator(".cdk-overlay-container tr-menu[data-place=\"shell.edit\"]")).toBeVisible();
    await expect(menuItem(window, "Edit")).toHaveAttribute("aria-expanded", "true");
    await window.keyboard.press("ArrowRight");
    await expect(window.locator(".cdk-overlay-container tr-menu[data-place=\"shell.view\"]")).toBeVisible();
    await expect(window.locator(".cdk-overlay-container tr-menu")).toHaveCount(1);
    await menuItem(window, "Notes").hover();
    await expect(window.locator(".cdk-overlay-container tr-menu[data-place=\"notes.tools\"]")).toBeVisible();
    await expect(window.locator(".cdk-overlay-container tr-menu")).toHaveCount(1);
    await desktop.checkpointAsync("menu-bar-open");
    await window.keyboard.press("Escape");
    await expect(window.locator(".cdk-overlay-container tr-menu")).toHaveCount(0);

    await menuItem(window, "Edit").click();
    await expect(window.locator(".cdk-overlay-container tr-menu[data-place=\"shell.edit\"]")).toBeVisible();
    await window.keyboard.press("Escape");
    await expect(window.locator(".cdk-overlay-container tr-menu")).toHaveCount(0);
    await expect(menuItem(window, "Edit")).toBeFocused();
  });

  test("F10 or a lone Alt focuses the menus, and Escape returns to the field that had the focus", async ({ desktop }) => {
    const window = desktop.window;
    await window.locator("tr-tab[data-tab-key=\"document/notes.note/1\"]").click();
    const tag = window.getByRole("textbox", { name: "Tag" });
    await tag.click();

    await window.keyboard.press("F10");
    await expect(menuItem(window, "File")).toBeFocused();
    await window.keyboard.press("Escape");
    await expect(tag).toBeFocused();
    await window.keyboard.press("Alt");
    await expect(menuItem(window, "File")).toBeFocused();
    await window.keyboard.press("ArrowRight");
    await window.keyboard.press("Escape");
    await expect(tag).toBeFocused();
    await window.keyboard.press("Alt+KeyF");
    await expect(tag).toBeFocused();
    await desktop.checkpointAsync("menu-bar-keys");
  });

  test("a row too narrow for the bar folds it into the menu button, and the bar returns when the row can hold it", async ({ desktop }) => {
    const window = desktop.window;
    const row = window.locator("tr-window-row");

    await row.evaluate(t => t.style.setProperty("width", "280px"));
    await expect(button(window)).toBeVisible();
    await expect(bar(window)).toBeHidden();
    await expect(bar(window)).toHaveAttribute("aria-hidden", "true");
    await desktop.checkpointAsync("menu-bar-folded");
    await button(window).click();
    await expect(window.locator("tr-menu.tr-window-row-menu-list button[tr-menu-item]")).toHaveText([/File/, /Edit/, /View/, /Notes/]);
    await window.keyboard.press("Escape");
    await expect(button(window)).toBeFocused();
    await window.keyboard.press("Escape");
    await window.locator("tr-tab[data-tab-key=\"document/notes.note/1\"]").click();
    await window.keyboard.press("F10");
    await expect(button(window)).toBeFocused();

    await row.evaluate(t => t.style.removeProperty("width"));
    await expect(bar(window)).toBeVisible();
    await expect(button(window)).toHaveCount(0);
  });

  test("as a button, the menus open from one menu button and the bar is gone", async ({ desktop }) => {
    const window = desktop.window;

    await setMenuBarAsync(window, "Button");
    await expect(button(window)).toHaveAttribute("aria-label", "Menu");
    await expect(bar(window)).toHaveCount(0);
    await desktop.checkpointAsync("menu-bar-button");
    await button(window).click();
    await expect(window.locator("tr-menu.tr-window-row-menu-list button[tr-menu-item]")).toHaveText([/File/, /Edit/, /View/, /Notes/]);
    await window.keyboard.press("Escape");

    await setMenuBarAsync(window, "Inline");
    await expect(bar(window)).toBeVisible();
    await expect(button(window)).toHaveCount(0);
  });

  test("hidden, the row has no menus at all, F10 does nothing and the commands stay in command search", async ({ desktop }) => {
    const window = desktop.window;
    await window.locator("tr-tab[data-tab-key=\"document/notes.note/1\"]").click();
    const tag = window.getByRole("textbox", { name: "Tag" });
    await tag.click();

    await setMenuBarAsync(window, "Hidden");
    await expect(bar(window)).toHaveCount(0);
    await expect(button(window)).toHaveCount(0);
    await window.keyboard.press("F10");
    await expect(tag).toBeFocused();
    await CommandSearchFixture.searchAsync(window, "new n");
    await expect(window.locator(".cdk-overlay-container .tr-command-search-pane [role=option][data-item=\"notes.newNote\"]")).toBeVisible();
    await desktop.checkpointAsync("menu-bar-hidden");
    await window.keyboard.press("Escape");

    await setMenuBarAsync(window, "Inline");
    await expect(bar(window)).toBeVisible();
  });
});
