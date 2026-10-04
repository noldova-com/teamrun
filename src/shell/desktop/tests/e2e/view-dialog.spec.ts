/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import CommandSearchFixture from "./fixtures/command-search.fixture.ts";
import type DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";

function dialog(window: Page): Locator {
  return window.getByRole("dialog");
}

async function showAsync(window: Page, title: string): Promise<void> {
  await CommandSearchFixture.searchAsync(window, title);
  await window.keyboard.press("Enter");
  await expect(dialog(window)).toBeVisible();
}

async function setModeAsync(window: Page, mode: string): Promise<void> {
  await window.evaluate(value => (Reflect.get(globalThis, "teamrun") as { request(method: string, payload: unknown): Promise<unknown> })
    .request("shell.setSetting", { name: "shell.mode", value }), mode);
  await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(mode.toLowerCase());
}

async function zoomAsync(desktop: DesktopApplicationFixture, factor: number, width: number): Promise<void> {
  await desktop.application.evaluate(({ BrowserWindow }, zoom) => BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(zoom), factor);
  await expect.poll(() => desktop.window.evaluate(() => innerWidth)).toBe(width);
}

async function expectInsideAsync(window: Page, locator: Locator): Promise<void> {
  const bounds = await locator.boundingBox();
  const viewport = await window.evaluate(() => [innerWidth, innerHeight]);
  expect(bounds).not.toBeNull();
  expect(bounds?.x).toBeGreaterThanOrEqual(0);
  expect(bounds?.y).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(viewport[0] ?? 0);
  expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(viewport[1] ?? 0);
}

test.describe("view dialog", () => {
  test("an open document moves into a large dialog, works there while the window behind stays still, and returns to its tab on Escape", async ({ desktop }) => {
    const window = desktop.window;
    const tab = window.locator("tr-tab[data-tab-key=\"document/notes.note/1\"]");
    const other = window.locator("tr-tab[data-tab-key=\"document/notes.note/2\"]");
    await tab.click();
    await expect(tab).toBeFocused();

    await showAsync(window, "Show note 1 in a dialog");

    await expect(dialog(window)).toHaveAccessibleName("Note 1");
    await expect(dialog(window).getByRole("textbox", { name: "Tag" })).toBeFocused();
    await expect(window.locator("[data-fixture-content=notes-note-1]")).toHaveCount(1);
    await expect(dialog(window).locator("[data-fixture-content=notes-note-1]")).toBeVisible();
    const bounds = await window.locator("tr-dialog").boundingBox();
    expect(Math.abs((bounds?.width ?? 0) - 1920 * 0.8)).toBeLessThan(2);
    expect(Math.abs((bounds?.height ?? 0) - 1080 * 0.8)).toBeLessThan(2);
    const summary = dialog(window).getByRole("textbox", { name: "Summary" });
    await summary.click();
    await window.keyboard.type("Plan the week");
    await expect(summary).toHaveValue("Plan the week");
    await window.keyboard.press("ControlOrMeta+KeyW");
    await window.keyboard.press("ControlOrMeta+KeyB");
    const behind = await other.boundingBox();
    await window.mouse.click((behind?.x ?? 0) + (behind?.width ?? 0) / 2, (behind?.y ?? 0) + (behind?.height ?? 0) / 2);
    await summary.focus();
    await window.keyboard.press("End");
    await window.keyboard.type("!");
    await expect(summary).toHaveValue("Plan the week!");
    await expect(dialog(window)).toBeVisible();
    await expect(tab).toBeAttached();
    await expect(other).toHaveAttribute("aria-selected", "false");
    await expect(window.locator("[data-fixture-content=notes-list]")).toBeAttached();
    await desktop.checkpointAsync("view-dialog-note-light");
    await setModeAsync(window, "Dark");
    await desktop.checkpointAsync("view-dialog-note-dark");
    await setModeAsync(window, "Light");

    await summary.focus();
    await window.keyboard.press("Escape");

    await expect(dialog(window)).toHaveCount(0);
    await expect(window.locator("tr-workspace [data-fixture-content=notes-note-1]")).toBeVisible();
    await expect(tab).toBeFocused();
    await expect(tab).toHaveAttribute("aria-selected", "true");
  });

  test("the keys of the module whose view a dialog shows run there while the shell's do nothing, and a document one opens closes the dialog and shows its tab", async ({ desktop }) => {
    const window = desktop.window;
    const note = window.locator("tr-tab[data-tab-key=\"document/notes.note/3\"]");
    await window.locator("[data-fixture-content=notes-list]").click();
    await showAsync(window, "Show the notes list in a dialog");
    await expect(dialog(window).locator(".tr-notes-list-item").first()).toBeFocused();

    await window.keyboard.press("ControlOrMeta+KeyW");
    await window.keyboard.press("ControlOrMeta+Alt+KeyN");

    await expect(dialog(window)).toHaveCount(0);
    await expect(note).toHaveAttribute("aria-selected", "true");
    await expect(note).toBeFocused();
    await expect(window.locator("tr-tab[data-tab-key=\"view/notes.list\"]")).toBeAttached();
    await expect(window.locator("tr-workspace [data-fixture-content=notes-list]")).toBeVisible();
  });

  test("a module's docked view and the shell's Settings show in a dialog that fits the smallest window and 200% zoom, and a tab that was not open closes with it", async ({ desktop }) => {
    const window = desktop.window;
    await desktop.useViewportAsync(640, 400);
    await window.locator("[data-fixture-content=notes-list]").click();

    await showAsync(window, "Show the notes list in a dialog");
    await expect(dialog(window)).toHaveAccessibleName("Notes");
    await expect(dialog(window).locator("[data-fixture-content=notes-list]")).toBeVisible();
    await expect(dialog(window).locator(".tr-notes-list-item").first()).toBeFocused();
    await expectInsideAsync(window, window.locator("tr-dialog"));
    await desktop.checkpointAsync("view-dialog-list-smallest");
    await window.keyboard.press("Escape");
    await expect(dialog(window)).toHaveCount(0);
    await expect(window.locator("tr-workspace [data-fixture-content=notes-list]")).toBeVisible();
    await expect(window.locator("tr-tab[data-tab-key=\"view/notes.list\"]")).toBeFocused();

    await showAsync(window, "Show Settings in a dialog");
    await expect(dialog(window)).toHaveAccessibleName("Settings");
    await expectInsideAsync(window, window.locator("tr-dialog"));
    await dialog(window).getByRole("button", { name: "Close" }).click();
    await expect(dialog(window)).toHaveCount(0);
    await expect(window.locator("tr-tab[data-tab-key=\"document/shell.settings\"]")).toHaveCount(0);

    await zoomAsync(desktop, 2, 320);
    try {
      await showAsync(window, "Show the notes list in a dialog");
      await expectInsideAsync(window, window.locator("tr-dialog"));
      await expectInsideAsync(window, dialog(window).getByRole("button", { name: "Close" }));
      await expect(dialog(window).locator("[data-fixture-content=notes-list]")).toBeVisible();
      await window.keyboard.press("Escape");
      await expect(dialog(window)).toHaveCount(0);
    }
    finally {
      await zoomAsync(desktop, 1, 640);
    }
  });
});
