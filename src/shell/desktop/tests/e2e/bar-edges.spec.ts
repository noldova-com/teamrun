/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Page } from "@playwright/test";

import type DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";

interface IBarEdges {
  readonly panels: readonly [number, number];
  readonly rowStart: number;
  readonly rowEnd: number;
  readonly controlsStart: number;
  readonly statusStart: number;
  readonly statusEnd: number;
}

async function edgesAsync(window: Page): Promise<IBarEdges> {
  await expect(window.locator(".tr-tab-group-card").first()).toBeVisible();
  await expect(window.locator(".tr-window-row-search")).toBeVisible();
  return window.evaluate(() => {
    const boxes = (selector: string): DOMRect[] => [...document.querySelectorAll(selector)].map(t => t.getBoundingClientRect()).filter(t => t.width > 0);
    const cards = boxes(".tr-tab-group-card");
    const row = document.querySelector("tr-window-row") as HTMLElement;
    const first = [...row.querySelectorAll(".tr-window-row-menu-bar:not(.tr-window-row-menu-bar-folded) .tr-window-row-menu-bar-item, .tr-window-row-menu, .tr-window-row-start")][0];
    const overlay = Reflect.get(navigator, "windowControlsOverlay") as { readonly visible: boolean; getTitlebarAreaRect(): DOMRect } | undefined;
    const area = overlay?.visible === true ? overlay.getTitlebarAreaRect() : null;
    const left = boxes(".tr-status-bar-left > *");
    const right = boxes(".tr-status-bar-right > *");
    return {
      panels: [Math.min(...cards.map(t => t.left)), Math.max(...cards.map(t => t.right))],
      rowStart: first?.getBoundingClientRect().left ?? Number.NaN,
      rowEnd: boxes(".tr-window-row-search")[0]?.right ?? Number.NaN,
      controlsStart: area === null ? innerWidth : area.right,
      statusStart: left[0]?.left ?? Number.NaN,
      statusEnd: right.at(-1)?.right ?? Number.NaN
    } as const;
  });
}

async function fullScreenAsync(desktop: DesktopApplicationFixture, isFullScreen: boolean): Promise<void> {
  await desktop.application.evaluate(({ BrowserWindow }, value) => BrowserWindow.getAllWindows()[0]?.setFullScreen(value), isFullScreen);
  await expect.poll(() => desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isFullScreen()), { timeout: 10_000 }).toBe(isFullScreen);
  await expect.poll(() => desktop.window.evaluate(() => document.querySelector("tr-window-row")?.classList.contains("tr-window-row-full-screen"))).toBe(isFullScreen);
}

test.describe("window row and status bar edges", () => {
  test("the outer controls of the window row and the status bar end on the panels' outer borders @smoke", async ({ desktop }) => {
    const window = desktop.window;
    const edges = await edgesAsync(window);
    await desktop.checkpointAsync("bar-edges");
    const [left, right] = edges.panels;
    const isMac = process.platform === "darwin";

    expect([edges.statusStart, edges.statusEnd, edges.rowEnd, isMac ? left : edges.rowStart]).toEqual([left, right, isMac ? right : edges.controlsStart, left]);
  });
});

test.describe("window row in macOS full screen", () => {
  test.skip(process.platform !== "darwin", "Only macOS keeps space for its window controls at the start of the row.");

  test("starts at the panels' left border in full screen, and after the traffic lights again once it leaves @smoke", async ({ desktop }) => {
    const window = desktop.window;
    const opened = await edgesAsync(window);

    await fullScreenAsync(desktop, true);
    const full = await edgesAsync(window);
    await fullScreenAsync(desktop, false);
    const left = await edgesAsync(window);
    await desktop.checkpointAsync("bar-edges-full-screen");

    expect([full.rowStart, full.rowEnd, full.statusStart, full.statusEnd]).toEqual([full.panels[0], full.panels[1], full.panels[0], full.panels[1]]);
    expect([opened.rowStart > opened.panels[0] + 60, left.rowStart]).toEqual([true, opened.rowStart]);
  });
});
