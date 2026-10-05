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

import ContrastFixture from "./fixtures/contrast.fixture.ts";
import type DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import ScrollAreaFixture from "./fixtures/scroll-area.fixture.ts";
import SettingsFixture from "./fixtures/settings.fixture.ts";
import TabDragFixture from "./fixtures/tab-drag.fixture.ts";
import WindowModeFixture from "./fixtures/window-mode.fixture.ts";

const settingsKey = "document/shell.settings";

function settingsTab(window: Page): Locator {
  return TabDragFixture.tab(window, settingsKey);
}

async function expectSamePageAsync(window: Page, top: number): Promise<void> {
  await expect(window.locator(".tr-settings-page[aria-current=page]")).toHaveText("Keyboard shortcuts");
  await expect.poll(() => ScrollAreaFixture.scrollTopAsync(window.locator(".tr-settings-content"))).toBe(top);
}

function row(window: Page, name: string): Locator {
  return window.locator(`tr-setting-row[data-setting="${name}"]`);
}

async function otherModeAsync(window: Page): Promise<"Light" | "Dark"> {
  return await window.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches) ? "Light" : "Dark";
}

async function chooseAsync(window: Page, name: string, option: string): Promise<void> {
  await row(window, name).getByRole("radio", { name: option, exact: true }).click();
}

async function rootFontSizeAsync(window: Page): Promise<string> {
  return await window.evaluate(() => getComputedStyle(document.documentElement).fontSize);
}

async function nativeBackgroundAsync(desktop: DesktopApplicationFixture): Promise<string> {
  return await desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getBackgroundColor() ?? "");
}

test.describe("settings", () => {
  test("a module's window part changes its setting, its runtime part uses the new value, and the value outlives reopening the window @smoke", async ({ desktop }) => {
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

  test("Settings opens by its key as one document, lists its pages and shows the shell's keys @smoke", async ({ desktop }) => {
    const window = desktop.window;

    await SettingsFixture.openAsync(window);
    await window.keyboard.press("ControlOrMeta+Comma");

    await expect(settingsTab(window)).toHaveCount(1);
    await expect(settingsTab(window)).toHaveAttribute("aria-selected", "true");
    await expect(window.locator(".tr-settings-page")).toHaveText(["Appearance", "Notifications", "Keyboard shortcuts", "Clock", "Gallery"]);
    await expect(window.locator(".tr-settings-group-title")).toHaveText(["Theme", "Text", "Layout", "Command search"]);
    await window.getByRole("button", { name: "Keyboard shortcuts", exact: true }).click();
    for (const scheme of ["light", "dark"] as const) {
      await window.emulateMedia({ colorScheme: scheme });
      await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(scheme);
      expect(await ContrastFixture.measureLowestTextContrastAsync(window.locator(".tr-settings-page[aria-current=page]"), ContrastFixture.SELECTED_ROW_BACKGROUND[scheme])).toBeGreaterThanOrEqual(ContrastFixture.MINIMUM_TEXT_CONTRAST);
    }
    await expect(window.locator("[data-command=\"shell.openSettings\"] td").first()).toHaveText("Settings…");
    await desktop.checkpointAsync("settings-shortcuts");
  });

  test("the page list reveals its scrollbar's thumb colour while hovered, a long page shows its thumb while hovered, and dragging that thumb scrolls the page", async ({ desktop }) => {
    const window = desktop.window;
    const content = window.locator(".tr-settings-content");
    await SettingsFixture.openGalleryAsync(window);
    await expect(content.locator("tr-quick-input").getByRole("option").first()).toBeAttached();
    expect(await content.evaluate(t => t.scrollHeight > t.clientHeight)).toBe(true);

    await ScrollAreaFixture.revealThumbColorAsync(window, window.locator(".tr-settings-pages"));
    expect(await ScrollAreaFixture.thumbChangesOnHoverAsync(window, content, "vertical")).toBe(true);
    const drag = await ScrollAreaFixture.dragVerticalThumbAsync(window, content, 100);

    await expect.poll(async () => Math.abs(await ScrollAreaFixture.scrollTopAsync(content) - drag.start - drag.distance)).toBeLessThan(drag.distance / 10);
  });

  test("on a wide panel Settings scrolls from its page list to the panel's edge, keeps its column's width and scrolls by the wheel past the column", async ({ desktop }) => {
    const window = desktop.window;
    const content = window.locator(".tr-settings-content");
    await desktop.useViewportAsync(2400, 1000);
    await SettingsFixture.openGalleryAsync(window);
    await expect(content.locator("tr-quick-input").getByRole("option").first()).toBeAttached();
    const [settings, scroller, column] = await Promise.all(["tr-settings", ".tr-settings-content", ".tr-settings-column"].map(t => window.locator(t).boundingBox()));
    const end = (box: typeof settings): number => (box?.x ?? 0) + (box?.width ?? 0);

    expect(Math.abs(end(scroller) - end(settings))).toBeLessThan(1);
    expect(await content.evaluate(t => getComputedStyle(t).scrollbarGutter)).toBe("stable");
    expect(end(column)).toBeLessThan(end(scroller) - 100);
    await window.mouse.move(end(column) + 50, (column?.y ?? 0) + 200);
    await window.mouse.wheel(0, 300);
    await expect.poll(() => ScrollAreaFixture.scrollTopAsync(content)).toBeGreaterThan(0);
    await ScrollAreaFixture.revealThumbColorAsync(window, content);
    await desktop.checkpointAsync("settings-wide-light");
    await WindowModeFixture.setAsync(window, "Dark");
    await ScrollAreaFixture.revealThumbColorAsync(window, content);
    await desktop.checkpointAsync("settings-wide-dark");
  });

  test("in a 1000 × 600 window Settings swaps its page list for a select, and its content takes the width, its controls work and its scrollbar drags", async ({ desktop }) => {
    const window = desktop.window;
    const content = window.locator(".tr-settings-content");
    const pages = window.locator(".tr-settings-page-select").getByRole("button");
    await SettingsFixture.openAsync(window);
    await expect(window.locator(".tr-settings-pages")).toBeVisible();
    await desktop.checkpointAsync("settings-default-light");

    await desktop.useViewportAsync(1000, 600);

    await expect(window.locator(".tr-settings-pages")).toBeHidden();
    await expect(pages).toHaveAccessibleName("Settings pages, Appearance");
    const [body, filled] = await Promise.all([window.locator(".tr-settings-body").boundingBox(), content.boundingBox()]);
    expect(Math.abs((filled?.width ?? 0) - (body?.width ?? -1))).toBeLessThan(1);
    await ScrollAreaFixture.revealThumbColorAsync(window, content);
    await desktop.checkpointAsync("settings-narrow-light");
    await WindowModeFixture.setAsync(window, "Dark");
    await ScrollAreaFixture.revealThumbColorAsync(window, content);
    await desktop.checkpointAsync("settings-narrow-dark");
    await chooseAsync(window, "shell.mode", "Light");
    await expect(row(window, "shell.mode").getByRole("radio", { name: "Light", exact: true })).toBeChecked();
    await SettingsFixture.choosePageAsync(window, "Gallery");
    await expect(content.locator("tr-quick-input").getByRole("option").first()).toBeAttached();
    const drag = await ScrollAreaFixture.dragVerticalThumbAsync(window, content, 100);
    await expect.poll(async () => Math.abs(await ScrollAreaFixture.scrollTopAsync(content) - drag.start - drag.distance)).toBeLessThan(drag.distance / 10);
  });

  test("search filters every page by title, description and name, marking the matches, and choosing a page ends it", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openAsync(window);

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

  test("Settings keeps its page and scroll position when its tab becomes active again and when it moves to another group", async ({ desktop }) => {
    const window = desktop.window;
    const note = "document/notes.note/2";
    await SettingsFixture.openAsync(window);
    await window.getByRole("button", { name: "Keyboard shortcuts", exact: true }).click();
    const top = await window.locator(".tr-settings-content").evaluate(async t => {
      t.scrollTop = 120;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return t.scrollTop;
    });
    expect(top).toBeGreaterThan(0);

    await TabDragFixture.tab(window, note).click();
    await expect(window.locator("tr-settings")).toHaveCount(0);
    await settingsTab(window).click();
    await expectSamePageAsync(window, top);

    await TabDragFixture.dragOntoPlateAsync(window, settingsKey, note, "Right");
    await window.mouse.up();

    await expect(window.locator("tr-tab-group").filter({ has: window.locator("tr-tab[data-tab-key^='document/']") })).toHaveCount(2);
    await expect.poll(() => TabDragFixture.tabKeysOf(TabDragFixture.groupOf(window, settingsKey))).toEqual([settingsKey]);
    await expectSamePageAsync(window, top);
  });

  test("changing the mode, a font and a size repaints the window at once, marks them modified, and Reset returns each", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openAsync(window);
    const mode = await otherModeAsync(window);
    const before = await window.evaluate(() => ({ font: getComputedStyle(document.body).fontFamily, size: getComputedStyle(document.documentElement).fontSize }));

    await chooseAsync(window, "shell.mode", mode);
    await chooseAsync(window, "shell.interfaceFont", "System");
    await row(window, "shell.panelSize").locator("input").fill("15");
    await row(window, "shell.panelSize").locator("input").press("Enter");

    await expect.poll(() => window.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(WindowModeFixture.backgrounds[mode]);
    await expect.poll(() => nativeBackgroundAsync(desktop)).toBe(mode === "Dark" ? "#181818" : "#F8F8F8");
    await expect.poll(async () => parseFloat(await rootFontSizeAsync(window))).toBeCloseTo(16 * 15 / 13, 2);
    for (const field of [row(window, "shell.panelSize").locator("input"), window.getByRole("searchbox", { name: "Search settings" })])
      expect(await field.evaluate(t => parseFloat(getComputedStyle(t).fontSize))).toBeCloseTo(15, 2);
    expect(await window.evaluate(() => getComputedStyle(document.body).fontFamily)).not.toBe(before.font);
    await expect(window.locator("tr-setting-row .tr-setting-row-marker")).toHaveCount(3);
    await desktop.checkpointAsync("settings-changed");
    for (const name of ["shell.mode", "shell.interfaceFont", "shell.panelSize"])
      await row(window, name).getByRole("button", { name: /^Reset / }).click();
    await expect(window.locator("tr-setting-row .tr-setting-row-marker")).toHaveCount(0);
    await expect.poll(() => rootFontSizeAsync(window)).toBe(before.size);
    expect(await window.evaluate(() => getComputedStyle(document.body).fontFamily)).toBe(before.font);
  });

  test("a size outside its range stays as typed with its error after focus leaves, applies once corrected, and Escape puts the stored size back", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openAsync(window);
    const field = row(window, "shell.panelSize").locator("input");
    const alert = row(window, "shell.panelSize").getByRole("alert");
    const before = await rootFontSizeAsync(window);

    await field.fill("30");
    await field.press("Tab");

    await expect(field).not.toBeFocused();
    await expect(field).toHaveValue("30");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(alert).toHaveText("Enter a whole number from 12 to 18.");
    await expect(row(window, "shell.panelSize").locator(".tr-setting-row-marker")).toHaveCount(0);
    expect(await rootFontSizeAsync(window)).toBe(before);
    await desktop.checkpointAsync("settings-number-error");
    await field.fill("15");
    await field.press("Enter");
    await expect(alert).toHaveCount(0);
    await expect(field).not.toHaveAttribute("aria-invalid");
    await expect.poll(async () => parseFloat(await rootFontSizeAsync(window))).toBeCloseTo(16 * 15 / 13, 2);
    await field.fill("40");
    await field.press("Enter");
    await expect(alert).toBeVisible();
    await field.press("Escape");
    await expect(field).toHaveValue("15");
    await expect(alert).toHaveCount(0);
    await expect(field).toBeFocused();
  });

  test("a checked checkbox centres its drawn tick in its box and has the hover radius, also at the largest panel size", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openAsync(window);
    const measureAsync = async (): Promise<readonly [number, number, string, string]> => {
      await SettingsFixture.choosePageAsync(window, "Notifications");
      const control = row(window, "shell.mutedModules").locator(".tr-checkbox-control").first();
      await expect(control.locator("input")).toBeChecked();
      return await control.evaluate(t => {
        const box = (t.querySelector("input") as HTMLInputElement).getBoundingClientRect();
        const tick = (t.querySelector(".tr-checkbox-mark path") as SVGPathElement).getBoundingClientRect();
        const probe = document.createElement("div");
        probe.style.borderTopLeftRadius = "var(--tr-radius-hover)";
        document.body.append(probe);
        const hover = getComputedStyle(probe).borderTopLeftRadius;
        probe.remove();
        return [
          Math.abs(tick.left + tick.right - box.left - box.right) / 2,
          Math.abs(tick.top + tick.bottom - box.top - box.bottom) / 2,
          getComputedStyle(t.querySelector("input") as HTMLInputElement).borderTopLeftRadius,
          hover
        ] as const;
      });
    };

    const regular = await measureAsync();
    await SettingsFixture.choosePageAsync(window, "Appearance");
    await row(window, "shell.panelSize").locator("input").fill("18");
    await row(window, "shell.panelSize").locator("input").press("Enter");
    await expect.poll(async () => parseFloat(await rootFontSizeAsync(window))).toBeCloseTo(16 * 18 / 13, 2);
    const largest = await measureAsync();

    for (const [horizontal, vertical, radius, hover] of [regular, largest]) {
      expect(horizontal).toBeLessThanOrEqual(0.5);
      expect(vertical).toBeLessThanOrEqual(0.5);
      expect(radius).toBe(hover);
    }
    await desktop.checkpointAsync("settings-checkbox");
  });

  test("a checked checkbox keeps its tick in the forced text color in forced colors", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openAsync(window);
    await window.getByRole("button", { name: "Notifications", exact: true }).click();
    const control = row(window, "shell.mutedModules").locator(".tr-checkbox-control").first();
    await expect(control.locator("input")).toBeChecked();
    const readAsync = (): Promise<readonly [boolean, string, string, string]> => control.evaluate(t => {
      const mark = getComputedStyle(t.querySelector(".tr-checkbox-mark") as Element);
      const probe = document.createElement("span");
      probe.style.color = "CanvasText";
      document.body.append(probe);
      const forced = getComputedStyle(probe).color;
      probe.remove();
      return [matchMedia("(forced-colors: active)").matches, mark.stroke, forced, getComputedStyle(t.querySelector("input") as Element).backgroundColor] as const;
    });

    await window.emulateMedia({ forcedColors: "active" });
    const [isForced, stroke, text, background] = await readAsync();

    expect(isForced).toBe(true);
    expect(stroke).toBe(text);
    expect(stroke).not.toBe(background);
    await desktop.checkpointAsync("settings-checkbox-forced-colors");
  });

  test("the Mode pills are one radio group: the checked pill is the tab stop and the arrow keys move the choice", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openAsync(window);
    const pill = (name: string): Locator => row(window, "shell.mode").getByRole("radiogroup", { name: "Mode" }).getByRole("radio", { name, exact: true });
    const backgroundAsync = (): Promise<string> => window.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await pill("Light").click();
    await expect.poll(backgroundAsync).toBe(WindowModeFixture.backgrounds.Light);
    await window.keyboard.press("ArrowRight");
    await expect(pill("Dark")).toBeChecked();
    await expect(pill("Dark")).toBeFocused();
    await expect.poll(backgroundAsync).toBe(WindowModeFixture.backgrounds.Dark);
    await window.keyboard.press("ArrowRight");
    await expect(pill("System")).toBeChecked();
    await window.keyboard.press("ArrowRight");
    await expect(pill("Light")).toBeChecked();
    await window.keyboard.press("End");
    await expect(pill("System")).toBeChecked();
    await window.keyboard.press("ArrowLeft");
    await expect(pill("Dark")).toBeChecked();
    await expect(pill("Light")).toHaveAttribute("tabindex", "-1");
    await expect(pill("Dark")).toHaveAttribute("tabindex", "0");
    await desktop.checkpointAsync("settings-mode-pills");
  });

  test("choosing a setting's default by hand removes its Modified marker and Reset, also after a restart", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openAsync(window);
    const mode = row(window, "shell.mode");

    await chooseAsync(window, "shell.mode", "Dark");
    await expect(mode.locator(".tr-setting-row-marker")).toHaveCount(1);
    await expect(mode.getByRole("button", { name: /^Reset / })).toHaveCount(1);
    await chooseAsync(window, "shell.mode", "System");

    await expect(mode.locator(".tr-setting-row-marker")).toHaveCount(0);
    await expect(mode.getByRole("button", { name: /^Reset / })).toHaveCount(0);
    await desktop.checkpointAsync("settings-default-by-hand");
    await desktop.restartAsync();
    await SettingsFixture.openAsync(desktop.window);
    await expect(row(desktop.window, "shell.mode").getByRole("radio", { name: "System" })).toBeChecked();
    await expect(row(desktop.window, "shell.mode").locator(".tr-setting-row-marker")).toHaveCount(0);
    await expect(row(desktop.window, "shell.mode").getByRole("button", { name: /^Reset / })).toHaveCount(0);
  });

  test("a restart paints the first frame in the chosen mode, before the runtime has given the window any setting", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openAsync(window);
    const mode = await otherModeAsync(window);
    await chooseAsync(window, "shell.mode", mode);
    await expect.poll(() => window.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(WindowModeFixture.backgrounds[mode]);

    await desktop.restartAsync(async () => {
      for (const file of ["shell.sqlite", "shell.sqlite-wal", "shell.sqlite-shm"])
        await rm(path.join(desktop.dataDirectory, file), { force: true });
      await writeFile(path.join(desktop.dataDirectory, "conversations.json"), "[]");
    });

    await expect(desktop.window.getByRole("heading", { name: "Data from an earlier TeamRun" })).toBeVisible();
    await expect(desktop.window.locator("tr-workspace")).toHaveCount(0);
    expect(await desktop.window.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.documentElement).colorScheme]))
      .toEqual([WindowModeFixture.backgrounds[mode], mode.toLowerCase()]);
    expect(await nativeBackgroundAsync(desktop)).toBe(mode === "Dark" ? "#181818" : "#F8F8F8");
    await desktop.checkpointAsync("settings-first-frame");
  });
});

test.describe("settings on macOS", () => {
  test.skip(process.platform !== "darwin", "Windows and Linux open Settings by its key and command search.");

  test("Settings… in the application menu shows its key and opens Settings @smoke", async ({ desktop }) => {
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
