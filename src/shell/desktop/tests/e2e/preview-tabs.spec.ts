/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import SettingsFixture from "./fixtures/settings.fixture.ts";

const documentsGroup = "tr-tab-group:has(tr-tab[data-tab-key='document/notes.note/1'])";

function tab(window: Page, week: number): Locator {
  return window.locator(`tr-tab[data-tab-key="document/notes.note/week-${week}"]`);
}

function listItem(window: Page, week: number): Locator {
  return window.locator(".tr-notes-list-item", { hasText: new RegExp(`^Meeting notes, week ${week}$`) });
}

function documentKeys(window: Page): Promise<readonly (string | null)[]> {
  return window.locator(`${documentsGroup} tr-tab`).evaluateAll(tabs => tabs.map(t => t.getAttribute("data-tab-key")));
}

function previewTabsRow(window: Page): Locator {
  return window.locator("tr-setting-row[data-setting=\"shell.previewTabs\"]");
}

function previewTabsSetting(window: Page): Locator {
  return previewTabsRow(window).getByRole("checkbox");
}

async function turnPreviewTabsOffAsync(window: Page): Promise<void> {
  await previewTabsSetting(window).uncheck();
  await expect(previewTabsRow(window).locator(".tr-setting-row-marker")).toHaveCount(1);
}

async function turnPreviewTabsOnAsync(window: Page): Promise<void> {
  await previewTabsRow(window).getByRole("button", { name: /^Reset / }).click();
  await expect(previewTabsRow(window).locator(".tr-setting-row-marker")).toHaveCount(0);
  await expect(previewTabsSetting(window)).toBeChecked();
}

async function expectPreviewAsync(locator: Locator, isPreview: boolean): Promise<void> {
  if (isPreview) {
    await expect(locator).toHaveClass(/tr-tab-preview/);
    await expect(locator).toHaveAttribute("aria-description", "Preview");
    await expect(locator.locator(".tr-tab-label")).toHaveCSS("font-style", "italic");
  }
  else {
    await expect(locator).not.toHaveClass(/tr-tab-preview/);
    await expect(locator).not.toHaveAttribute("aria-description");
    await expect(locator.locator(".tr-tab-label")).toHaveCSS("font-style", "normal");
  }
}

test.describe("preview tabs", () => {
  test("a note opened from the list is an italic preview that the next one replaces, and a double-click keeps it", async ({ desktop }) => {
    const window = desktop.window;

    await listItem(window, 1).click();
    await expectPreviewAsync(tab(window, 1), true);
    await expect(tab(window, 1)).toHaveAttribute("aria-selected", "true");
    await listItem(window, 2).click();

    await expect(tab(window, 1)).toHaveCount(0);
    await expectPreviewAsync(tab(window, 2), true);
    await expect.poll(() => documentKeys(window)).toEqual(["document/notes.note/1", "document/notes.note/2", "document/notes.note/week-2"]);

    await tab(window, 2).dblclick();
    await expectPreviewAsync(tab(window, 2), false);
    await listItem(window, 3).click();
    await expectPreviewAsync(tab(window, 3), true);
    await listItem(window, 4).dblclick();

    await expect(tab(window, 3)).toHaveCount(0);
    await expectPreviewAsync(tab(window, 4), false);
    await expect.poll(() => documentKeys(window)).toEqual(["document/notes.note/1", "document/notes.note/2", "document/notes.note/week-2", "document/notes.note/week-4"]);
    await desktop.checkpointAsync("preview-tabs-kept");
  });

  test("a preview is kept from the keyboard through its tab menu", async ({ desktop }) => {
    const window = desktop.window;
    await listItem(window, 5).click();
    await expectPreviewAsync(tab(window, 5), true);

    await tab(window, 5).focus();
    await window.keyboard.press("Shift+F10");
    await expect.poll(() => window.evaluate(() => document.activeElement?.querySelector(".tr-menu-item-label")?.textContent ?? null)).toBe("Keep open");
    await window.keyboard.press("Enter");

    await expect(window.locator(".cdk-overlay-container tr-menu")).toHaveCount(0);
    await expectPreviewAsync(tab(window, 5), false);
    await expect(tab(window, 5)).toBeFocused();
  });

  test("a preview keeps its place and its preview state after a restart", async ({ desktop }) => {
    await listItem(desktop.window, 6).dblclick();
    await listItem(desktop.window, 7).click();
    await expectPreviewAsync(tab(desktop.window, 7), true);
    const before = await documentKeys(desktop.window);

    await desktop.restartAsync();

    await expect.poll(() => documentKeys(desktop.window)).toEqual(before);
    await expectPreviewAsync(tab(desktop.window, 7), true);
    await expectPreviewAsync(tab(desktop.window, 6), false);
  });

  test("with Preview tabs off, a single click opens a kept tab and the next note opens a second tab", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openAsync(window);
    await expect(previewTabsSetting(window)).toBeChecked();
    await turnPreviewTabsOffAsync(window);

    await listItem(window, 1).click();
    await expect(tab(window, 1)).toHaveAttribute("aria-selected", "true");
    await expectPreviewAsync(tab(window, 1), false);
    await listItem(window, 2).click();
    await expect(tab(window, 2)).toHaveAttribute("aria-selected", "true");

    await expectPreviewAsync(tab(window, 1), false);
    await expectPreviewAsync(tab(window, 2), false);
    await expect.poll(() => documentKeys(window)).toEqual(["document/notes.note/1", "document/notes.note/2", "document/shell.settings", "document/notes.note/week-1", "document/notes.note/week-2"]);
    await desktop.checkpointAsync("preview-tabs-off");
  });

  test("turning Preview tabs off keeps the open preview, and turning it back on previews later opens again", async ({ desktop }) => {
    const window = desktop.window;
    await listItem(window, 3).click();
    await expectPreviewAsync(tab(window, 3), true);

    await SettingsFixture.openAsync(window);
    await turnPreviewTabsOffAsync(window);
    await expectPreviewAsync(tab(window, 3), false);
    await turnPreviewTabsOnAsync(window);
    await listItem(window, 4).click();
    await expectPreviewAsync(tab(window, 4), true);
    await listItem(window, 5).click();

    await expect(tab(window, 4)).toHaveCount(0);
    await expectPreviewAsync(tab(window, 5), true);
    await expectPreviewAsync(tab(window, 3), false);
  });
});
