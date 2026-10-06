/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import ClockWorkFixture from "./fixtures/clock-work.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import LayoutFixture from "./fixtures/layout.fixture.ts";
import SettingsFixture from "./fixtures/settings.fixture.ts";

async function openMenuAsync(window: Page): Promise<Locator> {
  await window.locator("tr-tab-group:has(tr-tab[data-tab-key=\"document/notes.note/1\"]) .tr-tab-group-menu").click();
  const menu = window.getByRole("menu").last();
  await expect(menu).toBeVisible();
  return menu;
}

test.describe("200% zoom", () => {
  test.beforeEach(async ({ desktop }) => {
    await expect(desktop.window.locator("tr-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();
    await desktop.zoomAsync(2, 960);
  });

  test("the window row, the status bar and the tab bars keep every control inside the window, uncovered and at least 24 × 24 px or spaced as large, and nothing scrolls sideways", async ({ desktop }) => {
    const window = desktop.window;

    expect(await window.evaluate(() => document.documentElement.scrollWidth)).toBe(960);
    expect(await LayoutFixture.findProblemsAsync(window.locator("tr-window-row, tr-status-bar, .tr-tab-group-bar"))).toEqual([]);
    await desktop.checkpointAsync("zoom-window");
  });

  test("a menu opens 0.5rem inside the window, and the arrow keys reach each of its items in view", async ({ desktop }) => {
    const window = desktop.window;
    const menu = await openMenuAsync(window);
    const items = await menu.getByRole("menuitem").count();

    expect(await LayoutFixture.findProblemsAsync(menu, LayoutFixture.OVERLAY_INSET)).toEqual([]);
    expect(await LayoutFixture.findFocusProblemsAsync(window, "ArrowDown", items)).toEqual([]);
    await desktop.checkpointAsync("zoom-menu");
  });

  test("a dialog opens 0.5rem inside the window, and Tab reaches each of its actions in view", async ({ desktop }) => {
    const window = desktop.window;
    await ClockWorkFixture.beginAsync(desktop);
    const asking = window.getByRole("dialog", { name: "Work is still running" });

    await desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
    await expect(asking).toBeVisible();

    expect(await LayoutFixture.findProblemsAsync(window.locator("tr-dialog"), LayoutFixture.OVERLAY_INSET)).toEqual([]);
    expect(await LayoutFixture.findFocusProblemsAsync(window, "Tab", await asking.getByRole("button").count() + 1)).toEqual([]);
    await desktop.checkpointAsync("zoom-dialog");
    await window.keyboard.press("Escape");
    await expect(asking).toHaveCount(0);
    await ClockWorkFixture.finishAsync(desktop.dataDirectory);
  });

  test("Settings keeps its pages and rows inside the window and uncovered, nothing scrolls sideways, and Tab reaches each field in view", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openAsync(window);
    const settings = window.locator("tr-settings");

    expect(await window.evaluate(() => document.documentElement.scrollWidth)).toBe(960);
    expect(await LayoutFixture.findProblemsAsync(settings)).toEqual([]);
    await settings.click({ position: { x: 4, y: 4 } });
    expect(await LayoutFixture.findFocusProblemsAsync(window, "Tab", await LayoutFixture.countTabStopsAsync(settings))).toEqual([]);
    await desktop.checkpointAsync("zoom-settings");
  });
});
