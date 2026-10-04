/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures/desktop-test.fixture.ts";

function scope(window: Page, mode: "Light" | "Dark"): Locator {
  return window.locator(`tr-gallery .tr-gallery-scope-frame[data-mode="${mode}"]`);
}

async function openGalleryAsync(window: Page): Promise<void> {
  await window.locator("tr-workspace").click({ position: { x: 4, y: 4 } });
  await window.keyboard.press("ControlOrMeta+Comma");
  await expect(window.locator("tr-settings")).toBeVisible();
  await window.getByRole("treeitem", { name: "Gallery", exact: true }).click();
  await expect(window.locator("tr-gallery")).toBeVisible();
}

test.describe("gallery", () => {
  test("a development build shows the kit's controls on a Settings page in every theme, in light and in dark", async ({ desktop }) => {
    const window = desktop.window;

    await openGalleryAsync(window);

    await expect(window.locator("tr-gallery .tr-gallery-scope-frame")).toHaveCount(2);
    await expect(window.locator("tr-gallery .tr-gallery-scope-title")).toHaveText(["Default, light mode", "Default, dark mode"]);
    await expect(scope(window, "Light").locator("tr-gallery-forms, tr-gallery-navigation, tr-gallery-overlays")).toHaveCount(3);
    const panels = await window.locator("tr-gallery .tr-gallery-scope-frame").evaluateAll(frames => frames.map(t => getComputedStyle(t).backgroundColor));
    expect(new Set(panels).size).toBe(2);
    await desktop.checkpointAsync("gallery-light");

    await scope(window, "Dark").scrollIntoViewIfNeeded();
    await scope(window, "Dark").locator(".tr-gallery-scope-title").scrollIntoViewIfNeeded();
    await desktop.checkpointAsync("gallery-dark");
  });

  test("each specimen with a control shows the keyboard focus on it from the keyboard, and each scope keeps its own colors", async ({ desktop }) => {
    const window = desktop.window;
    await openGalleryAsync(window);
    const dark = scope(window, "Dark");

    for (const name of ["Button", "Icon button", "Checkbox", "Text field", "Select", "Tab", "Tree", "Toolbar", "Toolbar button", "Menu"]) {
      await dark.getByRole("button", { name: `Show the keyboard focus on the ${name}`, exact: true }).focus();
      await window.keyboard.press("Enter");
      await expect(dark.locator(`.tr-gallery-specimen[aria-label="${name}"] :focus-visible`)).toHaveCount(1);
    }
    await desktop.checkpointAsync("gallery-focus");
    const colors = await window.locator("tr-gallery .tr-gallery-scope-frame").evaluateAll(frames => frames.map(t => getComputedStyle(t).color));
    expect(new Set(colors).size).toBe(2);
  });

  test("the tree is moved through, opened, closed and chosen from by keyboard alone", async ({ desktop }) => {
    const window = desktop.window;
    await openGalleryAsync(window);
    const tree = scope(window, "Light").getByRole("tree", { name: "Gallery files" });
    const item = (name: string): Locator => tree.getByRole("treeitem", { name, exact: true });
    await scope(window, "Light").getByRole("button", { name: "Show the keyboard focus on the Tree", exact: true }).focus();
    await window.keyboard.press("Enter");
    await expect(item("Project")).toBeFocused();

    await window.keyboard.press("ArrowRight");
    await expect(item("Project")).toHaveAttribute("aria-expanded", "true");
    await window.keyboard.press("ArrowRight");
    await expect(item("Source")).toBeFocused();
    await window.keyboard.press("ArrowRight");
    await window.keyboard.press("ArrowDown");
    await expect(item("App")).toBeFocused();
    await expect(item("App")).toHaveAttribute("aria-level", "3");
    await window.keyboard.press("End");
    await expect(item("A file name that is far too long to fit the width of its tree")).toBeFocused();
    await window.keyboard.press("Home");
    await window.keyboard.press("r");
    await expect(item("Readme")).toBeFocused();
    await window.keyboard.press("Enter");
    await expect(item("Readme")).toHaveAttribute("aria-selected", "true");
    await expect(item("Notes")).toHaveAttribute("aria-selected", "false");
    await desktop.checkpointAsync("gallery-tree");
    await window.keyboard.press("ArrowLeft");
    await expect(item("Project")).toBeFocused();
    await window.keyboard.press("ArrowLeft");
    await expect(item("Project")).toHaveAttribute("aria-expanded", "false");
    await expect(tree.getByRole("treeitem")).toHaveCount(3);
  });
});
