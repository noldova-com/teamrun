/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import ScrollAreaFixture from "./fixtures/scroll-area.fixture.ts";
import SettingsFixture from "./fixtures/settings.fixture.ts";

function scope(window: Page, mode: "Light" | "Dark"): Locator {
  return window.locator(`tr-gallery .tr-gallery-scope-frame[data-mode="${mode}"]`);
}

async function truncationAsync(control: Locator): Promise<{ isInside: boolean; isCut: boolean; overflow: string }> {
  return control.evaluate(t => {
    const box = t.getBoundingClientRect();
    const label = t.querySelector("[data-truncates]") as HTMLElement;
    const text = label.getBoundingClientRect();
    return {
      isInside: text.left >= box.left - 0.5 && text.right <= box.right + 0.5,
      isCut: label.scrollWidth > label.clientWidth,
      overflow: getComputedStyle(label).textOverflow
    };
  });
}

test.describe("gallery", () => {
  test("a development build shows the kit's controls on a Settings page in every theme, in light and in dark", async ({ desktop }) => {
    const window = desktop.window;

    await SettingsFixture.openGalleryAsync(window);

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

  test("the Gallery opens at its top, and moving a quick input's active option scrolls only its own list", async ({ desktop }) => {
    const window = desktop.window;
    const page = window.locator(".tr-settings-content");
    const quick = scope(window, "Dark").locator("tr-quick-input");
    const list = quick.locator(".tr-quick-input-list");
    const scrollTopAsync = (area: Locator): Promise<number> => area.evaluate(t => t.scrollTop);

    await SettingsFixture.openGalleryAsync(window);
    await expect(quick.getByRole("option").first()).toBeAttached();
    await window.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await scrollTopAsync(page)).toBe(0);

    await quick.scrollIntoViewIfNeeded();
    await list.evaluate(t => t.style.setProperty("max-height", `${(t.querySelector("[role=option]") as HTMLElement).offsetHeight * 1.5}px`));
    const top = await scrollTopAsync(page);
    await quick.locator(".tr-quick-input-field").focus();
    await window.keyboard.press("End");
    await expect.poll(() => scrollTopAsync(list)).toBeGreaterThan(0);
    expect(await scrollTopAsync(page)).toBe(top);
    await window.keyboard.press("Home");
    await expect.poll(() => scrollTopAsync(list)).toBe(0);
    expect(await scrollTopAsync(page)).toBe(top);
  });

  test("each specimen with a control shows the keyboard focus on it from the keyboard, and each scope keeps its own colors", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openGalleryAsync(window);
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

  test("toolbar buttons never overlap, and a label too long for its button ends with an ellipsis inside it and shows in full in its tooltip, in light and in dark", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openGalleryAsync(window);

    for (const mode of ["Light", "Dark"] as const) {
      const specimen = scope(window, mode).locator(".tr-gallery-specimen[aria-label=\"Toolbar button\"]");
      await specimen.scrollIntoViewIfNeeded();
      const overlaps = await specimen.evaluate(t => {
        const boxes = [...t.querySelectorAll(".tr-toolbar-button")].map(u => u.getBoundingClientRect());
        return boxes.flatMap((box, i) => boxes.slice(i + 1).filter(other => Math.min(box.right, other.right) - Math.max(box.left, other.left) > 0.5 &&
          Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top) > 0.5).map(() => i));
      });
      expect(overlaps).toEqual([]);
      const long = specimen.locator(".tr-toolbar-button.tr-gallery-narrow");
      expect(await truncationAsync(long)).toEqual({ isInside: true, isCut: true, overflow: "ellipsis" });
      await long.hover();
      await expect(scope(window, mode).locator(".cdk-overlay-container tr-tooltip")).toHaveText((await long.getAttribute("aria-label")) ?? "");
      await desktop.checkpointAsync(`toolbar-button-long-label-${mode.toLowerCase()}`);
      await window.mouse.move(0, 0);
    }
  });

  test("the text field and the select write in the panel text size, and an open select's list shows its thumb while hovered, in light and in dark", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openGalleryAsync(window);

    for (const mode of ["Light", "Dark"] as const) {
      const specimen = scope(window, mode).locator(".tr-gallery-specimen[aria-label=\"Select\"]");
      await specimen.scrollIntoViewIfNeeded();
      const sizes = await scope(window, mode).evaluate(t => {
        const probe = t.appendChild(document.createElement("div"));
        probe.style.fontSize = "var(--tr-text-panel)";
        const panel = getComputedStyle(probe).fontSize;
        probe.style.fontSize = "var(--tr-text-label)";
        const label = getComputedStyle(probe).fontSize;
        probe.remove();
        const field = t.querySelector(".tr-gallery-specimen[aria-label=\"Text field\"] input") as Element;
        const select = t.querySelector(".tr-gallery-specimen[aria-label=\"Select\"] .tr-select-button") as Element;
        return { panel, label, field: getComputedStyle(field).fontSize, select: getComputedStyle(select).fontSize };
      });
      expect(sizes.panel).not.toBe(sizes.label);
      expect([sizes.field, sizes.select]).toEqual([sizes.panel, sizes.panel]);

      await specimen.locator(".tr-select-button").first().click();
      const list = scope(window, mode).locator(".cdk-overlay-container .tr-select-list");
      await expect(list).toBeVisible();
      await list.evaluate(t => t.style.setProperty("max-height", `${(t.querySelector(".tr-select-option") as HTMLElement).offsetHeight * 1.5}px`));
      expect(await list.evaluate(t => t.scrollHeight > t.clientHeight)).toBe(true);
      expect(await ScrollAreaFixture.thumbChangesOnHoverAsync(window, list, "vertical")).toBe(true);
      await desktop.checkpointAsync(`select-list-thumb-${mode.toLowerCase()}`);
      await window.keyboard.press("Escape");
      await expect(list).toHaveCount(0);
    }
  });

  test("a button's label too long for it starts at its start padding, ends with an ellipsis and shows in full in its tooltip, in light and in dark", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openGalleryAsync(window);

    for (const mode of ["Light", "Dark"] as const) {
      const button = scope(window, mode).locator(".tr-gallery-specimen[aria-label=\"Button\"] button.tr-gallery-narrow");
      await button.scrollIntoViewIfNeeded();
      const start = await button.evaluate(t => {
        const style = getComputedStyle(t);
        const label = t.querySelector("[data-truncates]") as HTMLElement;
        return Math.round(label.getBoundingClientRect().left - t.getBoundingClientRect().left - Number.parseFloat(style.borderLeftWidth) - Number.parseFloat(style.paddingLeft));
      });
      expect(start).toBe(0);
      expect(await truncationAsync(button)).toEqual({ isInside: true, isCut: true, overflow: "ellipsis" });
      await button.hover();
      await expect(scope(window, mode).locator(".cdk-overlay-container tr-tooltip")).toHaveText(await button.innerText());
      await desktop.checkpointAsync(`button-long-label-${mode.toLowerCase()}`);
      await window.mouse.move(0, 0);
    }
  });
});
