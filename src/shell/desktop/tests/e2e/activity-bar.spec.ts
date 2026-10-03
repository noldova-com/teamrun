/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures/desktop-test.fixture.ts";

const notes = "view/notes.list";
const outline = "view/notes.outline";

async function setDockStyleAsync(window: Page, name: string, value: string): Promise<void> {
  await window.evaluate(([setting, style]) => (Reflect.get(globalThis, "teamrun") as { request(method: string, payload: unknown): Promise<unknown> })
    .request("shell.setSetting", { name: setting, value: style }), [name, value] as const);
}

function strip(window: Page): Locator {
  return window.locator("tr-dock[data-side=Left] .tr-dock-strip-rail");
}

function icon(window: Page, key: string): Locator {
  return strip(window).locator(`[data-view="${key}"]`);
}

test.describe("activity bar", () => {
  test.beforeEach(async ({ desktop }) => {
    await expect(desktop.window.locator(`tr-tab[data-tab-key="${notes}"]`)).toBeVisible();
  });

  test("a side shown as icons keeps a toolbar of its views on the window's edge that opens and closes them", async ({ desktop }) => {
    const window = desktop.window;
    const group = window.locator("tr-tab-group[data-side=Left]");

    await setDockStyleAsync(window, "shell.leftDockStyle", "Icons");
    await expect(strip(window)).toHaveAttribute("role", "toolbar");
    await expect(strip(window)).toHaveAttribute("aria-orientation", "vertical");
    await expect(icon(window, notes)).toHaveAttribute("aria-pressed", "true");
    await expect(icon(window, outline)).toHaveAttribute("aria-pressed", "false");
    const [rail, panel] = [await strip(window).boundingBox(), await group.boundingBox()];
    expect((rail?.x ?? Infinity) + (rail?.width ?? 0)).toBeLessThan(panel?.x ?? 0);
    await desktop.checkpointAsync("left-dock-icons");

    await icon(window, notes).click();
    await expect(group).toHaveCount(0);
    await expect(icon(window, notes)).toHaveAttribute("aria-pressed", "false");
    await icon(window, outline).click();
    await expect(group.locator("tr-tab[data-tab-key=\"view/notes.outline\"]")).toHaveAttribute("aria-selected", "true");
    await expect(icon(window, outline)).toHaveAttribute("aria-pressed", "true");

    await setDockStyleAsync(window, "shell.leftDockStyle", "Tabs");
    await expect(strip(window)).toHaveCount(0);
    await expect(group.locator("[role=tablist]")).toBeVisible();
  });

  test("a view's badge shows after its tab's title, then on its icon, and joins its accessible name", async ({ desktop }) => {
    const window = desktop.window;
    const clockTab = window.locator("tr-tab[data-tab-key=\"view/clock.face\"]");
    const clockIcon = window.locator("tr-dock[data-side=Right] .tr-dock-strip-view[data-view=\"view/clock.face\"]");
    await expect(clockTab).toHaveAccessibleName("Clock");
    await expect(clockTab.locator("tr-view-badge")).toHaveCount(0);

    await window.locator("[data-fixture-content=notes-list]").click();
    await window.keyboard.press("ControlOrMeta+Alt+KeyT");
    await expect(clockTab.locator("tr-view-badge")).toHaveText("1");
    await expect(clockTab).toHaveAccessibleName("Clock, 1 ticks");
    await setDockStyleAsync(window, "shell.rightDockStyle", "Icons");

    await expect(clockIcon.locator("tr-view-badge")).toHaveText("1");
    await expect(clockIcon).toHaveAccessibleName("Clock, 1 ticks");
    await desktop.checkpointAsync("view-badge");
  });

  test("the strip is one tab stop driven by the arrow keys, and a one-view group shows a header instead of a tab", async ({ desktop }) => {
    const window = desktop.window;
    await setDockStyleAsync(window, "shell.leftDockStyle", "Icons");
    await setDockStyleAsync(window, "shell.rightDockStyle", "Icons");
    await expect(icon(window, outline)).toBeVisible();

    await icon(window, outline).focus();
    await window.keyboard.press("ArrowUp");
    await expect(icon(window, notes)).toBeFocused();
    await window.keyboard.press("End");
    await expect(icon(window, outline)).toBeFocused();
    await window.keyboard.press("Enter");
    await expect(icon(window, outline)).toHaveAttribute("aria-pressed", "true");
    await expect(icon(window, outline)).toHaveAttribute("tabindex", "0");
    await expect(icon(window, notes)).toHaveAttribute("tabindex", "-1");

    await expect(window.locator("tr-tab-group[data-side=Right] .tr-tab-group-title")).toHaveText("Clock");
    await expect(window.locator("tr-tab-group[data-side=Right] [role=tablist]")).toHaveCount(0);
    await expect(window.locator("tr-tab-group[data-side=Right] [role=region]")).toHaveAccessibleName("Clock");
    await desktop.checkpointAsync("one-view-header");
  });
});
