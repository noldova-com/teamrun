/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import LayoutFixture from "./fixtures/layout.fixture.ts";
import SettingsFixture from "./fixtures/settings.fixture.ts";

const DEFAULT_PANEL_SIZE = 13;
const SCALE_TOLERANCE = 0.5;
const POINTER_TARGET = 24;

async function setSizesAsync(window: Page, size: number): Promise<void> {
  for (const name of ["shell.panelSize", "shell.messageSize", "shell.codeSize"])
    await window.evaluate(([setting, value]) => (Reflect.get(globalThis, "teamrun") as { request(method: string, payload: unknown): Promise<unknown> })
      .request("shell.setSetting", { name: setting, value }), [name, size] as const);
  await expect.poll(() => window.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(16 * size / DEFAULT_PANEL_SIZE, 2);
  await expect.poll(() => window.evaluate(() => ["--tr-text-message", "--tr-text-code"].map(t => getComputedStyle(document.documentElement).getPropertyValue(t)))).toEqual([`${size}px`, `${size}px`]);
}

async function measureAsync(window: Page): Promise<{ sizes: Record<string, number>; borders: Record<string, number>; windowRow: number; iconButton: number; rem: number }> {
  return await window.evaluate(() => {
    const find = (selector: string): Element => {
      const element = document.querySelector(selector);
      if (element === null)
        throw new Error(`Nothing matches ${selector}.`);
      return element;
    };
    const height = (selector: string): number => find(selector).getBoundingClientRect().height;
    const style = (selector: string): CSSStyleDeclaration => getComputedStyle(find(selector));
    return {
      sizes: {
        statusBar: height("tr-status-bar"),
        tab: height("tr-tab"),
        tabStart: parseFloat(style("tr-tab").paddingInlineStart),
        statusBarItem: height("tr-status-bar-item .tr-status-bar-item"),
        statusBarItemStart: parseFloat(style("tr-status-bar-item .tr-status-bar-item").paddingInlineStart),
        toolbarButton: height("tr-toolbar button")
      },
      borders: {
        tabGroupCard: parseFloat(style(".tr-tab-group-card").borderTopWidth),
        statusBar: parseFloat(style("tr-status-bar").borderTopWidth)
      },
      windowRow: height("tr-window-row"),
      iconButton: height(".tr-window-row-search"),
      rem: parseFloat(getComputedStyle(document.documentElement).fontSize)
    };
  });
}

async function checkSizeAsync(window: Page, size: number): Promise<void> {
  const base = await measureAsync(window);
  await setSizesAsync(window, size);
  const measured = await measureAsync(window);

  const ratio = size / DEFAULT_PANEL_SIZE;
  expect(Object.entries(measured.sizes).filter(([name, value]) => Math.abs(value - (base.sizes[name] ?? 0) * ratio) > SCALE_TOLERANCE)
    .map(([name, value]) => `${name}: ${value} px at ${size}, ${base.sizes[name]} px at ${DEFAULT_PANEL_SIZE}`)).toEqual([]);
  expect(measured.borders).toEqual(base.borders);
  expect(Math.abs(measured.windowRow - (Math.max(measured.iconButton, POINTER_TARGET) + measured.rem / 2))).toBeLessThanOrEqual(SCALE_TOLERANCE);
  expect(await LayoutFixture.findProblemsAsync(window.locator("tr-window-row, tr-status-bar, .tr-tab-group-bar"))).toEqual([]);
  expect(await LayoutFixture.findCutTextAsync(window.locator("tr-window-row, tr-status-bar, .tr-tab-group-bar"))).toEqual([]);
}

async function checkSettingsAsync(window: Page): Promise<void> {
  await SettingsFixture.openAsync(window);
  const settings = window.locator("tr-settings");

  expect(await LayoutFixture.findProblemsAsync(settings)).toEqual([]);
  expect(await LayoutFixture.findCutTextAsync(settings)).toEqual([]);
}

test.describe("the smallest and largest text", () => {
  test.beforeEach(async ({ desktop }) => {
    await expect(desktop.window.locator("tr-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();
  });

  test("at size 12, the window's geometry scales with the panel size, the window row keeps room for a 24px pointer target, its borders keep their width, and its controls and Settings' stay inside the window, uncovered and uncut", async ({ desktop }) => {
    await checkSizeAsync(desktop.window, 12);
    await desktop.checkpointAsync("text-size-smallest");
    await checkSettingsAsync(desktop.window);
    await desktop.checkpointAsync("text-size-smallest-settings");
  });

  test("at size 18, the window's geometry scales with the panel size, the window row keeps room for a 24px pointer target, its borders keep their width, and its controls and Settings' stay inside the window, uncovered and uncut", async ({ desktop }) => {
    await checkSizeAsync(desktop.window, 18);
    await desktop.checkpointAsync("text-size-largest");
    await checkSettingsAsync(desktop.window);
    await desktop.checkpointAsync("text-size-largest-settings");
  });

  test("message and code text take their own sizes at 12 and at 18", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openGalleryAsync(window);
    const card = window.locator("tr-gallery .tr-gallery-specimen[aria-label=\"Card\"] tr-card").first();
    const code = window.locator("tr-gallery .tr-gallery-specimen[aria-label=\"Code block\"] .tr-code-block-body").first();

    for (const size of [12, 18]) {
      await setSizesAsync(window, size);
      await expect(card).toHaveCSS("font-size", `${size}px`);
      await expect(code).toHaveCSS("font-size", `${size}px`);
    }
    await desktop.checkpointAsync("text-size-gallery-largest");
  });
});
