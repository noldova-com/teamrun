/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ClockWorkFixture from "./fixtures/clock-work.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import LayoutFixture from "./fixtures/layout.fixture.ts";
import SettingsFixture from "./fixtures/settings.fixture.ts";

test.describe("the smallest window", () => {
  test.beforeEach(async ({ desktop }) => {
    await expect(desktop.window.locator("tr-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();
    await desktop.useViewportAsync(640, 480);
  });

  test("keeps the window row, the status bar, the tab bars and the collapsed docks' strips inside the window and uncovered, and the document area in view", async ({ desktop }) => {
    const window = desktop.window;
    const documents = window.locator("tr-tab-group:has(tr-tab[data-tab-key=\"document/notes.note/1\"])");

    await expect(window.locator(".tr-dock-strip").first()).toBeVisible();
    expect(await window.evaluate(() => document.documentElement.scrollWidth)).toBe(640);
    expect(await LayoutFixture.findProblemsAsync(window.locator("tr-window-row, tr-status-bar, .tr-tab-group-bar, .tr-dock-strip:visible"))).toEqual([]);
    expect(await LayoutFixture.findCutTextAsync(window.locator("tr-window-row, tr-status-bar, .tr-tab-group-bar"))).toEqual([]);
    expect(await documents.locator(".tr-tab-group-body").evaluate(t => {
      const box = t.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return box.width > 0 && box.height > 0 && box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight && hit !== null && t.contains(hit);
    })).toBe(true);
    await desktop.checkpointAsync("small-window");
  });

  test("opens a dialog 0.5rem inside the window, and Tab reaches each of its actions in view", async ({ desktop }) => {
    const window = desktop.window;
    await ClockWorkFixture.beginAsync(desktop);
    const asking = window.getByRole("dialog", { name: "Work is still running" });

    await desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
    await expect(asking).toBeVisible();

    expect(await LayoutFixture.findProblemsAsync(window.locator("tr-dialog"), LayoutFixture.OVERLAY_INSET)).toEqual([]);
    expect(await LayoutFixture.findCutTextAsync(window.locator("tr-dialog"))).toEqual([]);
    expect(await LayoutFixture.findFocusProblemsAsync(window, "Tab", await LayoutFixture.countTabStopsAsync(window.locator("tr-dialog")))).toEqual([]);
    await desktop.checkpointAsync("small-window-dialog");
    await window.keyboard.press("Escape");
    await expect(asking).toHaveCount(0);
    await ClockWorkFixture.finishAsync(desktop.dataDirectory);
  });

  test("keeps Settings' rows inside the window, uncovered and uncut with nothing scrolling sideways, and Tab reaches each of its fields in view", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openAsync(window);
    const settings = window.locator("tr-settings");

    expect(await window.evaluate(() => document.documentElement.scrollWidth)).toBe(640);
    expect(await LayoutFixture.findProblemsAsync(settings)).toEqual([]);
    expect(await LayoutFixture.findCutTextAsync(settings)).toEqual([]);
    await settings.click({ position: { x: 4, y: 4 } });
    expect(await LayoutFixture.findFocusProblemsAsync(window, "Tab", await LayoutFixture.countTabStopsAsync(settings))).toEqual([]);
    await desktop.checkpointAsync("small-window-settings");
  });
});
