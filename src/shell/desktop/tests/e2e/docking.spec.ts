/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import BuildVariantFixture from "./fixtures/build-variant.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";

const notes = "view/notes.list";
const outline = "view/notes.outline";
const clock = "view/clock.face";
const firstNote = "document/notes.note/1";
const secondNote = "document/notes.note/2";
const withoutClock = "without-clock";

function tab(window: Page, key: string): Locator {
  return window.locator(`tr-tab[data-tab-key="${key}"]`);
}

function groupOf(window: Page, key: string): Locator {
  return window.locator("tr-tab-group").filter({ has: tab(window, key) });
}

async function centerOf(locator: Locator): Promise<{ readonly x: number; readonly y: number }> {
  const box = await locator.boundingBox();
  if (box === null)
    throw new Error("The element is not visible.");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function startDragAsync(window: Page, key: string): Promise<void> {
  const start = await centerOf(tab(window, key));
  await window.mouse.move(start.x, start.y);
  await window.mouse.down();
  await window.mouse.move(start.x + 12, start.y + 12, { steps: 3 });
}

async function moveOverAsync(window: Page, target: Locator, offsetX: number = 0): Promise<void> {
  const point = await centerOf(target);
  await window.mouse.move(point.x + offsetX, point.y, { steps: 6 });
}

async function dragOntoPlateAsync(window: Page, key: string, groupKey: string, direction: string): Promise<void> {
  await startDragAsync(window, key);
  await moveOverAsync(window, groupOf(window, groupKey).locator("[role=tabpanel]"));
  await moveOverAsync(window, window.locator(`tr-docking-plate [data-direction=${direction}]`));
}

function tabKeysOf(group: Locator): Promise<readonly (string | null)[]> {
  return group.locator("tr-tab").evaluateAll(tabs => tabs.map(t => t.getAttribute("data-tab-key")));
}

async function describePlacesAsync(window: Page): Promise<readonly unknown[]> {
  return window.locator("tr-tab-group").evaluateAll(groups => groups.map(group => [
    group.getAttribute("data-side"),
    [...group.querySelectorAll("tr-tab")].map(t => t.getAttribute("data-tab-key")),
    group.getBoundingClientRect().toJSON()
  ]));
}

async function closeMenusAsync(window: Page): Promise<void> {
  await expect(window.locator(".cdk-overlay-container tr-menu")).toHaveCount(0);
}

async function describeGroupsAsync(window: Page): Promise<readonly (readonly [string | null, readonly string[]])[]> {
  return window.locator("tr-tab-group").evaluateAll(groups => groups.map(group => [
    group.getAttribute("data-side"),
    [...group.querySelectorAll("tr-tab")].map(t => t.getAttribute("data-tab-key") ?? "")
  ] as const));
}

function contrast(foreground: string, background: string): number {
  const luminance = (color: string): number => {
    const [red = 0, green = 0, blue = 0] = (color.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(t => Number(t) / 255)
      .map(t => t <= 0.03928 ? t / 12.92 : ((t + 0.055) / 1.055) ** 2.4);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const [lighter = 0, darker = 0] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

test.describe("docking", () => {
  test.beforeEach(async ({ desktop }) => {
    await desktop.useSuiteViewportAsync();
    await expect(tab(desktop.window, notes)).toBeVisible();
    await expect(tab(desktop.window, secondNote)).toBeVisible();
  });

  test("dragging a view's tab onto a group's center adds it to that group", async ({ desktop }) => {
    const window = desktop.window;
    await dragOntoPlateAsync(window, notes, clock, "Center");

    await expect(window.locator("tr-docking-plate [data-direction=Center]")).toHaveClass(/tr-docking-guide-chosen/);
    await expect(window.locator(".tr-docking-preview")).toBeVisible();
    await expect(window.locator(".tr-drag-label")).toContainText("Moving Notes");
    await window.mouse.up();

    await expect.poll(() => tabKeysOf(groupOf(window, clock))).toEqual([clock, notes]);
    await expect(window.locator("tr-docking-guide, .tr-docking-preview, .tr-drag-label")).toHaveCount(0);
    await desktop.checkpointAsync("dropped-on-a-group-center");
  });

  for (const [direction, axis] of [["Left", "x"], ["Right", "x"], ["Top", "y"], ["Bottom", "y"]] as const) {
    test(`the ${direction.toLowerCase()} arrow splits the group and places the tab on that side`, async ({ desktop }) => {
      const window = desktop.window;
      const before = await window.locator("tr-tab-group").count();
      await dragOntoPlateAsync(window, outline, clock, direction);
      await window.mouse.up();

      await expect(window.locator("tr-tab-group")).toHaveCount(before + 1);
      const moved = await groupOf(window, outline).boundingBox();
      const stayed = await groupOf(window, clock).boundingBox();
      expect((moved?.[axis] ?? 0) < (stayed?.[axis] ?? 0)).toBe(direction === "Left" || direction === "Top");
      await expect(window.locator("tr-split-sash")).toHaveCount(1);
    });
  }

  test("a side guide docks the tab along that whole side, centered in its landing area", async ({ desktop }) => {
    const window = desktop.window;
    await startDragAsync(window, notes);
    await moveOverAsync(window, window.locator("[data-drop-side=Bottom]"));

    const preview = await centerOf(window.locator(".tr-docking-preview"));
    const guide = await centerOf(window.locator("[data-drop-side=Bottom]"));
    expect(Math.abs(preview.x - guide.x)).toBeLessThan(1);
    expect(Math.abs(preview.y - guide.y)).toBeLessThan(1);
    await window.mouse.up();

    await expect(window.locator("tr-tab-group[data-side=Bottom]")).toHaveCount(1);
    await expect(window.locator("tr-tab-group[data-side=Bottom] tr-tab")).toHaveAttribute("data-tab-key", notes);
  });

  test("dropping away from every target or pressing Escape changes nothing", async ({ desktop }) => {
    const window = desktop.window;
    const before = await describeGroupsAsync(window);

    await startDragAsync(window, notes);
    await moveOverAsync(window, window.locator("tr-status-bar"));
    await window.mouse.up();
    await startDragAsync(window, notes);
    await moveOverAsync(window, window.locator("[data-drop-side=Right]"));
    await window.keyboard.press("Escape");
    await expect(window.locator("tr-docking-guide")).toHaveCount(0);
    await window.mouse.up();

    expect(await describeGroupsAsync(window)).toEqual(before);
    await expect(window.locator(".tr-docking-preview, tr-docking-guide, .tr-drag-label")).toHaveCount(0);
  });

  test("a document's tab shows no guides and only reorders within its group", async ({ desktop }) => {
    const window = desktop.window;
    await startDragAsync(window, firstNote);
    await moveOverAsync(window, tab(window, secondNote), 30);

    await expect(window.locator("tr-docking-guide")).toHaveCount(0);
    await expect(window.locator(".tr-drag-label")).toContainText("Moving Note 1");
    await window.mouse.up();

    await expect.poll(() => tabKeysOf(groupOf(window, firstNote))).toEqual([secondNote, firstNote]);
  });

  test("a dock's sash resizes it by pointer and keyboard and reports its size", async ({ desktop }) => {
    const window = desktop.window;
    const sash = window.getByRole("separator", { name: "Resize the left dock" });
    const dock = groupOf(window, notes);
    const width = (await dock.boundingBox())?.width ?? 0;
    const grip = await centerOf(sash);

    await window.mouse.move(grip.x, grip.y);
    await window.mouse.down();
    await window.mouse.move(grip.x + 80, grip.y, { steps: 8 });
    await window.mouse.up();
    await expect.poll(async () => Math.round((await dock.boundingBox())?.width ?? 0)).toBe(Math.round(width + 80));

    await sash.focus();
    await window.keyboard.press("ArrowLeft");
    await expect.poll(async () => Math.round((await dock.boundingBox())?.width ?? 0)).toBe(Math.round(width + 72));
    await expect(sash).toHaveAttribute("aria-valuenow", String(Math.round(width + 72)));
  });

  test("the tab menu docks a view and reorders a document from the keyboard", async ({ desktop }) => {
    const window = desktop.window;
    await tab(window, notes).focus();
    await window.keyboard.press("Shift+F10");
    await window.getByRole("menuitem", { name: "Dock", exact: true }).click();
    await window.getByRole("menuitem", { name: "Dock at the bottom" }).click();
    await closeMenusAsync(window);

    await expect(window.locator("tr-tab-group[data-side=Bottom] tr-tab")).toHaveAttribute("data-tab-key", notes);
    await expect(tab(window, notes)).toBeFocused();

    await tab(window, firstNote).focus();
    await window.keyboard.press("Shift+F10");
    await window.getByRole("menuitem", { name: "Move right" }).click();
    await closeMenusAsync(window);
    await expect.poll(() => tabKeysOf(groupOf(window, firstNote))).toEqual([secondNote, firstNote]);
    await expect(tab(window, firstNote)).toBeFocused();

    await window.keyboard.press("Home");
    await expect(tab(window, secondNote)).toBeFocused();
    await expect(tab(window, secondNote)).toHaveAttribute("aria-selected", "true");
  });

  test("Reset the layout returns the views to their default places", async ({ desktop }) => {
    const window = desktop.window;
    const initial = await describeGroupsAsync(window);
    await dragOntoPlateAsync(window, notes, clock, "Bottom");
    await window.mouse.up();
    await expect.poll(() => describeGroupsAsync(window)).not.toEqual(initial);

    await tab(window, notes).click({ button: "right" });
    await window.getByRole("menuitem", { name: "Reset the layout" }).click();

    await expect.poll(() => describeGroupsAsync(window)).toEqual(initial);
  });

  for (const reopen of [true, false])
    test(`the layout, its splits and sizes return ${reopen ? "after reopening on the running runtime" : "after a restart that stops the runtime"}`, async ({ desktop }) => {
      await dragOntoPlateAsync(desktop.window, outline, notes, "Bottom");
      await desktop.window.mouse.up();
      const sash = desktop.window.getByRole("separator", { name: "Resize the right dock" });
      const size = Number(await sash.getAttribute("aria-valuenow"));
      await sash.focus();
      await desktop.window.keyboard.press("ArrowLeft");
      await expect(sash).toHaveAttribute("aria-valuenow", String(size + 8));
      await expect(desktop.window.locator("tr-split-sash")).toHaveCount(1);
      const before = await describePlacesAsync(desktop.window);

      await (reopen ? desktop.reopenAsync() : desktop.restartAsync());
      await desktop.useSuiteViewportAsync();

      await expect(tab(desktop.window, outline)).toBeVisible();
      await expect.poll(() => describePlacesAsync(desktop.window)).toEqual(before);
    });

  test("a view whose module is absent keeps its place and returns there with its module", async ({ desktop }) => {
    await startDragAsync(desktop.window, clock);
    await moveOverAsync(desktop.window, desktop.window.locator("[data-drop-side=Bottom]"));
    await desktop.window.mouse.up();
    await expect(desktop.window.locator("tr-tab-group[data-side=Bottom]")).toHaveCount(1);
    const before = await describePlacesAsync(desktop.window);

    await desktop.restartAsync(() => BuildVariantFixture.swapInAsync(withoutClock));
    await desktop.useSuiteViewportAsync();
    await expect(tab(desktop.window, notes)).toBeVisible();
    await expect(tab(desktop.window, clock)).toHaveCount(0);
    await expect(desktop.window.locator("tr-tab-group[data-side=Bottom]")).toHaveCount(0);

    await desktop.restartAsync(() => BuildVariantFixture.restoreAsync());
    await desktop.useSuiteViewportAsync();
    await expect(tab(desktop.window, clock)).toBeVisible();
    await expect.poll(() => describePlacesAsync(desktop.window)).toEqual(before);
  });

  test("tabs, guides, the plate, the preview and sashes follow the component table", async ({ desktop }) => {
    const window = desktop.window;
    await dragOntoPlateAsync(window, notes, clock, "Center");
    const measured = await window.evaluate(() => {
      const element = (selector: string): Element => {
        const found = document.querySelector(selector);
        if (found === null)
          throw new Error(`No ${selector} element.`);
        return found;
      };
      const style = (selector: string): CSSStyleDeclaration => getComputedStyle(element(selector));
      const box = (selector: string): DOMRect => element(selector).getBoundingClientRect();
      const probe = document.createElement("div");
      probe.style.borderTop = "1px solid var(--tr-accent)";
      probe.style.backgroundColor = "var(--tr-selected)";
      document.body.append(probe);
      const surfaces = [getComputedStyle(probe).borderTopColor, getComputedStyle(probe).backgroundColor];
      probe.remove();
      const unselected = element("tr-tab:not(.tr-tab-selected)");
      const card = unselected.closest("tr-panel-card");
      return {
        guide: [box("[data-drop-side=Left]").width, box("[data-drop-side=Left]").height, style("[data-drop-side=Left]").borderTopLeftRadius],
        plate: [style("tr-docking-plate").rowGap, style("tr-docking-plate").borderTopLeftRadius],
        preview: [style(".tr-docking-preview").borderTopWidth, style(".tr-docking-preview").borderTopLeftRadius],
        previewColors: [style(".tr-docking-preview").borderTopColor, style(".tr-docking-preview").backgroundColor],
        surfaces,
        tabHeight: unselected.getBoundingClientRect().height,
        tabColors: [getComputedStyle(unselected).color, card === null ? "" : getComputedStyle(card).backgroundColor],
        sash: box("tr-dock tr-sash").width
      };
    });
    await window.keyboard.press("Escape");
    await window.mouse.up();

    expect(measured.guide).toEqual([40, 40, "4px"]);
    expect(measured.plate).toEqual(["2px", "6px"]);
    expect(measured.preview).toEqual(["1px", "8px"]);
    expect(measured.previewColors).toEqual(measured.surfaces);
    expect(measured.tabHeight).toBeGreaterThanOrEqual(32);
    expect(contrast(measured.tabColors[0] ?? "", measured.tabColors[1] ?? "")).toBeGreaterThanOrEqual(4.5);
    expect(measured.sash).toBe(4);
  });
});
