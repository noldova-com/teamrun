/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Locator, Page } from "@playwright/test";

import type DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";

const windowColors = { Light: "rgb(248, 248, 248)", Dark: "rgb(24, 24, 24)" };

function settingsTab(window: Page): Locator {
  return window.locator("tr-tab[data-tab-key=\"document/shell.settings\"]");
}

function row(window: Page, name: string): Locator {
  return window.locator(`tr-setting-row[data-setting="${name}"]`);
}

async function openSettingsAsync(window: Page): Promise<void> {
  await window.locator("tr-workspace").click({ position: { x: 4, y: 4 } });
  await window.keyboard.press("ControlOrMeta+Comma");
  await expect(window.locator("tr-settings")).toBeVisible();
}

async function otherModeAsync(window: Page): Promise<"Light" | "Dark"> {
  return await window.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches) ? "Light" : "Dark";
}

async function chooseAsync(window: Page, name: string, option: string): Promise<void> {
  await row(window, name).locator(".tr-select-button").click();
  await window.getByRole("option", { name: option, exact: true }).click();
}

async function nativeBackgroundAsync(desktop: DesktopApplicationFixture): Promise<string> {
  return await desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getBackgroundColor() ?? "");
}

test.describe("settings", () => {
  test("a module's window part changes its setting, its runtime part uses the new value, and the value outlives reopening the window", async ({ desktop }) => {
    const step = (): Locator => desktop.window.locator("[data-fixture-content=clock-step]");
    await expect(step()).toHaveText("Step: 1");

    await desktop.window.locator("[data-fixture-content=clock-step-up]").click();
    await expect(step()).toHaveText("Step: 2");
    await desktop.window.locator("[data-fixture-content=notes-list]").click();
    await desktop.window.keyboard.press("ControlOrMeta+Alt+KeyT");

    await expect(desktop.window.locator("[data-fixture-content=clock-ticks]")).toHaveText("Ticks: 2");
    await desktop.reopenAsync();
    await expect(step()).toHaveText("Step: 2");
    await desktop.checkpointAsync("settings-module-step");
  });

  test("Settings opens by its key as one document, lists its pages and shows the shell's keys", async ({ desktop }) => {
    const window = desktop.window;

    await openSettingsAsync(window);
    await window.keyboard.press("ControlOrMeta+Comma");

    await expect(settingsTab(window)).toHaveCount(1);
    await expect(settingsTab(window)).toHaveAttribute("aria-selected", "true");
    await expect(window.locator(".tr-settings-page")).toHaveText(["Appearance", "Notifications", "Keyboard shortcuts", "Clock", "Gallery"]);
    await expect(window.locator(".tr-settings-group-title")).toHaveText(["Theme", "Text", "Layout"]);
    await window.getByRole("button", { name: "Keyboard shortcuts", exact: true }).click();
    await expect(window.locator("[data-command=\"shell.openSettings\"] td").first()).toHaveText("Settings…");
    await desktop.checkpointAsync("settings-shortcuts");
  });

  test("search filters every page by title, description and name, marking the matches, and choosing a page ends it", async ({ desktop }) => {
    const window = desktop.window;
    await openSettingsAsync(window);

    await window.getByRole("searchbox", { name: "Search settings" }).fill("size");

    await expect(window.locator(".tr-settings-result-title")).toHaveText(["Appearance"]);
    await expect(window.locator("tr-setting-row .tr-setting-row-title")).toHaveText(["Interface text size", "Message text size", "Code text size"]);
    await expect(window.locator("tr-setting-row mark").first()).toHaveText("size");
    await desktop.checkpointAsync("settings-search");
    await window.getByRole("searchbox", { name: "Search settings" }).fill("clock.tickStep");
    await expect(window.locator(".tr-settings-result-title")).toHaveText(["Clock"]);
    await window.getByRole("button", { name: "Notifications", exact: true }).click();
    await expect(window.getByRole("searchbox", { name: "Search settings" })).toHaveValue("");
    await expect(window.locator(".tr-settings-group-title")).toHaveText(["Notifications"]);
  });

  test("changing the mode, a font and a size repaints the window at once, marks them modified, and Reset returns each", async ({ desktop }) => {
    const window = desktop.window;
    await openSettingsAsync(window);
    const mode = await otherModeAsync(window);
    const before = await window.evaluate(() => ({ font: getComputedStyle(document.body).fontFamily, size: getComputedStyle(document.documentElement).fontSize }));

    await chooseAsync(window, "shell.mode", mode);
    await chooseAsync(window, "shell.interfaceFont", "System");
    await row(window, "shell.panelSize").locator("input").fill("15");
    await row(window, "shell.panelSize").locator("input").press("Enter");

    await expect.poll(() => window.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(windowColors[mode]);
    await expect.poll(() => nativeBackgroundAsync(desktop)).toBe(mode === "Dark" ? "#181818" : "#F8F8F8");
    await expect.poll(() => window.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(16 * 15 / 13, 2);
    expect(await window.evaluate(() => getComputedStyle(document.body).fontFamily)).not.toBe(before.font);
    await expect(window.locator("tr-setting-row .tr-setting-row-marker")).toHaveCount(3);
    await desktop.checkpointAsync("settings-changed");
    for (const name of ["shell.mode", "shell.interfaceFont", "shell.panelSize"])
      await row(window, name).getByRole("button", { name: /^Reset / }).click();
    await expect(window.locator("tr-setting-row .tr-setting-row-marker")).toHaveCount(0);
    await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe(before.size);
    expect(await window.evaluate(() => getComputedStyle(document.body).fontFamily)).toBe(before.font);
  });

  test("a restart paints the first frame in the chosen mode, before the runtime has given the window any setting", async ({ desktop }) => {
    const window = desktop.window;
    await openSettingsAsync(window);
    const mode = await otherModeAsync(window);
    await chooseAsync(window, "shell.mode", mode);
    await expect.poll(() => window.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(windowColors[mode]);

    await desktop.restartAsync(async () => {
      for (const file of ["shell.sqlite", "shell.sqlite-wal", "shell.sqlite-shm"])
        await rm(path.join(desktop.dataDirectory, file), { force: true });
      await writeFile(path.join(desktop.dataDirectory, "conversations.json"), "[]");
    });

    await expect(desktop.window.getByRole("heading", { name: "Data from an earlier TeamRun" })).toBeVisible();
    await expect(desktop.window.locator("tr-workspace")).toHaveCount(0);
    expect(await desktop.window.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.documentElement).colorScheme]))
      .toEqual([windowColors[mode], mode.toLowerCase()]);
    expect(await nativeBackgroundAsync(desktop)).toBe(mode === "Dark" ? "#181818" : "#F8F8F8");
    await desktop.checkpointAsync("settings-first-frame");
  });
});

test.describe("settings on macOS", () => {
  test.skip(process.platform !== "darwin", "Windows and Linux open Settings by its key and command search.");

  test("Settings… in the application menu shows its key and opens Settings", async ({ desktop }) => {
    const item = (): Promise<readonly [string, boolean, string] | null> => desktop.application.evaluate(({ Menu }) => {
      const found = Menu.getApplicationMenu()?.getMenuItemById("shell.app/shell.settings/0");
      return found ? [found.label, found.enabled, String(found.accelerator)] as const : null;
    });

    await expect.poll(item).toEqual(["Settings…", true, "Command+,"]);
    await desktop.application.evaluate(({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById("shell.app/shell.settings/0")?.click());

    await expect(desktop.window.locator("tr-settings")).toBeVisible();
    await expect(settingsTab(desktop.window)).toHaveAttribute("aria-selected", "true");
  });
});
