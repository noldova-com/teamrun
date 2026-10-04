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

async function layoutProblemsAsync(window: Page): Promise<readonly string[]> {
  return window.locator("tr-gallery").evaluate(gallery => {
    const problems: string[] = [];
    const tolerance = 1;
    const overlaps = (a: DOMRect, b: DOMRect): boolean => Math.min(a.right, b.right) - Math.max(a.left, b.left) > tolerance && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > tolerance;
    for (const specimen of gallery.querySelectorAll<HTMLElement>(".tr-gallery-specimen")) {
      const name = specimen.getAttribute("aria-label") ?? "";
      const head = specimen.querySelector<HTMLElement>(".tr-gallery-specimen-head");
      if (head?.querySelector("h3")?.textContent !== name)
        problems.push(`${name}: no header with its name`);
      const cells = [...specimen.querySelectorAll<HTMLElement>(".tr-gallery-specimen-cells > tr-gallery-cell")];
      if (cells.length === 0)
        problems.push(`${name}: no cells`);
      const boxes = cells.map(t => t.getBoundingClientRect());
      boxes.forEach((box, i) => {
        const caption = cells[i]?.getAttribute("aria-label");
        const first = boxes[0] as DOMRect;
        const previous = boxes[i - 1];
        if (Math.abs(box.width - first.width) > tolerance)
          problems.push(`${name}: ${caption} is ${box.width}px wide, not ${first.width}px`);
        if (previous !== undefined && box.left > previous.left + tolerance && Math.abs(box.top - previous.top) > tolerance)
          problems.push(`${name}: ${caption} does not share its row's top edge`);
      });
      const parts = [...(head === null ? [] : [head]), ...cells, ...specimen.querySelectorAll<HTMLElement>(".tr-gallery-specimen-long > tr-gallery-cell")];
      parts.forEach((part, i) => parts.slice(i + 1).filter(other => overlaps(part.getBoundingClientRect(), other.getBoundingClientRect()))
        .forEach(other => problems.push(`${name}: ${part.getAttribute("aria-label") ?? "the header"} overlaps ${other.getAttribute("aria-label")}`)));
      for (const cell of parts.filter(t => t.localName === "tr-gallery-cell")) {
        const box = cell.getBoundingClientRect();
        const outside = [...cell.querySelectorAll<HTMLElement>(".tr-gallery-cell-specimen > *")].map(t => t.getBoundingClientRect())
          .some(t => t.width > 0 && (t.left < box.left - tolerance || t.right > box.right + tolerance));
        if (outside)
          problems.push(`${name}: ${cell.getAttribute("aria-label")} is wider than its cell`);
      }
      if (specimen.scrollWidth > specimen.clientWidth + tolerance)
        problems.push(`${name}: scrolls sideways`);
    }
    return problems;
  });
}

async function openGalleryAsync(window: Page): Promise<void> {
  await window.locator("tr-workspace").click({ position: { x: 4, y: 4 } });
  await window.keyboard.press("ControlOrMeta+Comma");
  await expect(window.locator("tr-settings")).toBeVisible();
  await window.getByRole("button", { name: "Gallery", exact: true }).click();
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

    for (const name of ["Button", "Icon button", "Checkbox", "Text field", "Select", "Tab", "Toolbar", "Toolbar button", "Menu"]) {
      await dark.getByRole("button", { name: `Show the keyboard focus on the ${name}`, exact: true }).focus();
      await window.keyboard.press("Enter");
      await expect(dark.locator(`.tr-gallery-specimen[aria-label="${name}"] :focus-visible`)).toHaveCount(1);
    }
    await desktop.checkpointAsync("gallery-focus");
    const colors = await window.locator("tr-gallery .tr-gallery-scope-frame").evaluateAll(frames => frames.map(t => getComputedStyle(t).color));
    expect(new Set(colors).size).toBe(2);
  });

  test("with the side docks hidden, every section has its header, and its cells share their width and their row's top edge without overlapping, at 100% and 200% zoom and in a narrow window", async ({ desktop }) => {
    const window = desktop.window;
    await openGalleryAsync(window);
    const zoomAsync = (factor: number): Promise<void> => desktop.application.evaluate(({ BrowserWindow }, value) => BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(value), factor);
    await window.keyboard.press("ControlOrMeta+B");
    await window.keyboard.press("ControlOrMeta+Alt+B");
    await expect.poll(() => window.locator("tr-tab-group[data-side=Left], tr-tab-group[data-side=Right]").evaluateAll(t => t.filter(u => u.getBoundingClientRect().width > 0).length)).toBe(0);

    expect(await window.locator("tr-gallery .tr-gallery-specimen").count()).toBeGreaterThan(20);
    expect(await layoutProblemsAsync(window)).toEqual([]);
    await scope(window, "Light").locator(".tr-gallery-specimen[aria-label=\"Button\"]").scrollIntoViewIfNeeded();
    await desktop.checkpointAsync("gallery-sections-light");
    await scope(window, "Dark").locator(".tr-gallery-specimen[aria-label=\"Button\"]").scrollIntoViewIfNeeded();
    await desktop.checkpointAsync("gallery-sections-dark");

    const width = await window.evaluate(() => innerWidth);
    await zoomAsync(2);
    await expect.poll(() => window.evaluate(() => innerWidth)).toBe(width / 2);
    expect(await layoutProblemsAsync(window)).toEqual([]);
    await zoomAsync(1);
    await expect.poll(() => window.evaluate(() => innerWidth)).toBe(width);

    await desktop.useViewportAsync(640, 400);
    expect(await layoutProblemsAsync(window)).toEqual([]);
    await desktop.checkpointAsync("gallery-sections-narrow");
  });
});
