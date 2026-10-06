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
import SettingsFixture from "./fixtures/settings.fixture.ts";

async function systemColorAsync(window: Page, name: string): Promise<string> {
  return window.evaluate(color => {
    const probe = document.body.appendChild(document.createElement("span"));
    probe.style.color = color;
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, name);
}

async function styleAsync(target: Locator, property: string, part: string | null = null): Promise<string> {
  return target.evaluate((element, [name, pseudo]) => getComputedStyle(element, pseudo).getPropertyValue(name as string), [property, part] as const);
}

test.describe("forced colors", () => {
  test("keep the current page, the selected tab, the current module, separators, grips and hover visible in the system's colors, light and dark", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openAsync(window);
    await window.emulateMedia({ forcedColors: "active", colorScheme: "light" });
    const highlight = await systemColorAsync(window, "Highlight");
    const text = await systemColorAsync(window, "HighlightText");
    const canvasText = await systemColorAsync(window, "CanvasText");
    const page = window.locator("tr-settings .tr-tree-row-current");
    const tab = window.locator(".tr-tab.tr-tab-selected .tr-tab-pill").first();
    const item = window.locator("button.tr-notifications-item");

    await expect(page).toHaveCSS("background-color", highlight);
    await expect(page.locator(".tr-tree-label")).toHaveCSS("color", text);
    await expect(tab).toHaveCSS("background-color", highlight);
    await expect(window.locator(".tr-toolbar-dot").first()).toHaveCSS("background-color", canvasText);
    await expect(window.locator(".tr-toolbar-separator").first()).toHaveCSS("background-color", canvasText);
    await item.hover();
    expect([await styleAsync(item, "outline-style"), await styleAsync(item, "outline-color")]).toEqual(["dashed", highlight]);
    await window.mouse.move(1, 1);
    await desktop.checkpointAsync("forced-colors-settings-light");

    await window.emulateMedia({ forcedColors: "active", colorScheme: "dark" });
    await CommandSearchFixture.searchAsync(window, "Modules");
    await window.keyboard.press("Enter");
    const current = window.locator(".tr-modules-row-current");
    await expect(current).toBeVisible();

    await expect(current).toHaveCSS("background-color", await systemColorAsync(window, "Highlight"));
    await expect(current).toHaveCSS("color", await systemColorAsync(window, "HighlightText"));
    await desktop.checkpointAsync("forced-colors-modules-dark");
  });

  test("give scroll areas the system's scrollbars", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openAsync(window);
    const content = window.locator("tr-settings .tr-settings-content");
    const gutterAsync = (): Promise<number> => content.evaluate(t => (t as HTMLElement).offsetWidth - t.clientWidth);
    const thin = await gutterAsync();

    await window.emulateMedia({ forcedColors: "active" });

    await expect.poll(gutterAsync).not.toBe(thin);
  });
});
