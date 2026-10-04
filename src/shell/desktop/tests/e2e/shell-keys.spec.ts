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

const isMac = process.platform === "darwin";

function note(window: Page, id: number): Locator {
  return window.locator(`tr-tab[data-tab-key="document/notes.note/${id}"]`);
}

function isCollapsedAsync(window: Page, side: string): Promise<boolean> {
  return window.locator(`tr-dock[data-side=${side}]`).evaluate(t => t.classList.contains("tr-dock-collapsed"));
}

test.describe("the shell's keys", () => {
  test("move between a group's tabs both ways and wrap, close the tab, and show or hide each dock", async ({ desktop }) => {
    const window = desktop.window;
    await note(window, 2).click();
    await expect(note(window, 2)).toBeFocused();

    await window.keyboard.press("Control+Tab");
    await expect(note(window, 1)).toBeFocused();
    await expect(note(window, 1)).toHaveAttribute("aria-selected", "true");
    await window.keyboard.press(isMac ? "Meta+Alt+ArrowRight" : "Control+PageDown");
    await expect(note(window, 2)).toBeFocused();
    await window.keyboard.press("Control+Shift+Tab");
    await expect(note(window, 1)).toBeFocused();
    await window.keyboard.press(isMac ? "Meta+Alt+ArrowLeft" : "Control+PageUp");
    await expect(note(window, 2)).toBeFocused();
    await expect(note(window, 2)).toHaveAttribute("aria-selected", "true");

    await window.keyboard.press("ControlOrMeta+KeyW");
    await expect(note(window, 2)).toHaveCount(0);
    await expect(note(window, 1)).toBeFocused();

    for (const [key, side] of [["ControlOrMeta+KeyB", "Left"], ["ControlOrMeta+KeyJ", "Bottom"], ["ControlOrMeta+Alt+KeyB", "Right"]] as const) {
      const collapsed = await isCollapsedAsync(window, side);
      await window.keyboard.press(key);
      await expect.poll(() => isCollapsedAsync(window, side)).toBe(!collapsed);
      await window.keyboard.press(key);
      await expect.poll(() => isCollapsedAsync(window, side)).toBe(collapsed);
    }
    await desktop.checkpointAsync("shell-keys");
  });

  test("the tab menu and command search show the keys by the platform's convention", async ({ desktop }) => {
    const window = desktop.window;
    await note(window, 2).click();

    await window.keyboard.press("Shift+F10");
    await expect(window.locator(".cdk-overlay-container button[data-command='shell.closeTab'] .tr-menu-item-shortcut")).toHaveText(isMac ? "⌘W" : "Ctrl+W");
    await window.keyboard.press("Escape");
    await expect(window.locator(".cdk-overlay-container tr-menu")).toHaveCount(0);

    await CommandSearchFixture.searchAsync(window, "tab");
    const row = (name: string): Locator => window.locator(`.tr-command-search-pane [data-item="${name}"] .tr-quick-input-key`);
    await expect(row("shell.nextTab")).toHaveText(isMac ? "⌃⇥" : "Ctrl+Tab");
    await expect(row("shell.previousTab")).toHaveText(isMac ? "⌃⇧⇥" : "Ctrl+Shift+Tab");
    await window.keyboard.press("Escape");
  });
});
