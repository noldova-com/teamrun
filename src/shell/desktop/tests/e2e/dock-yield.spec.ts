/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import type DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import TabDragFixture from "./fixtures/tab-drag.fixture.ts";
import WindowModeFixture from "./fixtures/window-mode.fixture.ts";

const notes = "view/notes.list";
const collapsed = /tr-dock-collapsed/;

function dock(window: Page, side: "Left" | "Right"): Locator {
  return window.locator(`tr-dock[data-side=${side}]`);
}

function middle(window: Page): Locator {
  return window.locator("tr-tab-group[data-group='0']");
}

async function widthAsync(locator: Locator): Promise<number> {
  return (await locator.boundingBox())?.width ?? 0;
}

async function expectNoSidewaysScrollAsync(window: Page): Promise<void> {
  expect(await window.evaluate(() => [document.documentElement.scrollWidth <= innerWidth, [...document.querySelectorAll("tr-workspace")].every(t => t.scrollWidth <= t.clientWidth)]))
    .toEqual([true, true]);
}

async function captureAsync(desktop: DesktopApplicationFixture, mode: "light" | "dark"): Promise<void> {
  const window = desktop.window;
  await desktop.useViewportAsync(1920, 1080);
  await expect(dock(window, "Right")).not.toHaveClass(collapsed);
  await desktop.checkpointAsync(`docks-default-${mode}`);
  await desktop.useViewportAsync(1000, 600);
  await expect.poll(() => widthAsync(dock(window, "Right"))).toBeLessThan(200);
  await desktop.checkpointAsync(`docks-1000x600-${mode}`);
  await desktop.useViewportAsync(640, 480);
  await expect(dock(window, "Left")).toHaveClass(collapsed);
  await desktop.checkpointAsync(`docks-minimum-${mode}`);
}

test.describe("docks giving way", () => {
  test.beforeEach(async ({ desktop }) => {
    await expect(TabDragFixture.tab(desktop.window, notes)).toBeVisible();
  });

  test("the side docks shrink and then collapse, right first, before the document narrows, and reopen past a margin as the window widens", async ({ desktop }) => {
    const window = desktop.window;
    const rem = await window.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    const offset = await window.evaluate(() => innerWidth - (document.querySelector("tr-workspace")?.getBoundingClientRect().width ?? 0));
    const at = (width: number): number => Math.round(width * rem + offset);

    await desktop.useViewportAsync(1000, 600);
    await expect.poll(() => widthAsync(dock(window, "Right"))).toBeLessThan(11 * rem);
    await expect(dock(window, "Left")).not.toHaveClass(collapsed);
    await expect(dock(window, "Right")).not.toHaveClass(collapsed);
    expect(await widthAsync(middle(window))).toBeGreaterThanOrEqual(30 * rem - 1);

    await desktop.useViewportAsync(at(50), 600);
    await expect(dock(window, "Right")).toHaveClass(collapsed);
    await expect(dock(window, "Left")).not.toHaveClass(collapsed);
    expect(await widthAsync(middle(window))).toBeGreaterThanOrEqual(30 * rem - 1);

    await desktop.useViewportAsync(640, 480);
    await expect(dock(window, "Left")).toHaveClass(collapsed);
    expect(await widthAsync(middle(window))).toBeGreaterThanOrEqual(30 * rem - 1);
    await expectNoSidewaysScrollAsync(window);

    await desktop.useViewportAsync(at(52), 600);
    await expect(dock(window, "Left")).not.toHaveClass(collapsed);
    await expect(dock(window, "Right")).toHaveClass(collapsed);
    await desktop.useViewportAsync(at(53.5), 600);
    await expect(dock(window, "Right")).not.toHaveClass(collapsed);
    await desktop.useViewportAsync(1000, 600);
    await expect.poll(() => widthAsync(middle(window))).toBeGreaterThanOrEqual(30 * rem - 1);
    await expectNoSidewaysScrollAsync(window);
  });

  test("a dock the narrow window closed opens from its strip, and the other dock closes instead", async ({ desktop }) => {
    const window = desktop.window;
    await desktop.useViewportAsync(640, 480);
    await expect(dock(window, "Left")).toHaveClass(collapsed);

    await dock(window, "Left").locator(".tr-dock-strip-view").first().click();

    await expect(dock(window, "Left")).not.toHaveClass(collapsed);
    await expect(dock(window, "Right")).toHaveClass(collapsed);
    await expect(dock(window, "Left").locator("tr-sash")).toBeVisible();
    await expectNoSidewaysScrollAsync(window);
  });

  test("the docks give way the same way in light and in dark", async ({ desktop }) => {
    await captureAsync(desktop, "light");
    await WindowModeFixture.setAsync(desktop.window, "Dark");
    await captureAsync(desktop, "dark");
  });
});
