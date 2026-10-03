/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures/desktop-test.fixture.ts";

const documentsGroup = "tr-tab-group:has(tr-tab[data-tab-key='document/notes.note/1'])";
const keyboardTitle = "Keyboard shortcuts and command search, including collisions between modules and the person's own bindings";

test.use({ desktopDataFiles: { "modules/notes/many-tabs": "" } });

function tab(window: Page, key: string): Locator {
  return window.locator(`tr-tab[data-tab-key="${key}"]`);
}

function menus(window: Page): Locator {
  return window.locator(".cdk-overlay-container tr-menu");
}

function focusedLabel(window: Page): Promise<string | null> {
  return window.evaluate(() => document.activeElement?.querySelector(".tr-menu-item-label")?.textContent ?? null);
}

function boxOf(locator: Locator): Promise<Readonly<Record<"left" | "top" | "right" | "bottom", number>>> {
  return locator.evaluate(t => {
    const box = t.getBoundingClientRect();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
  });
}

function boundsOf(window: Page): Promise<Readonly<Record<"left" | "top" | "right" | "bottom", number>>> {
  return window.evaluate(() => {
    const gap = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.5;
    const top = (document.querySelector("tr-window-row") as Element).getBoundingClientRect().bottom + gap;
    const bottom = (document.querySelector("tr-status-bar") as Element).getBoundingClientRect().top - gap;
    return { left: gap, top, right: document.documentElement.clientWidth - gap, bottom };
  });
}

function expectInside(box: Readonly<Record<"left" | "top" | "right" | "bottom", number>>, bounds: Readonly<Record<"left" | "top" | "right" | "bottom", number>>): void {
  expect(box.left).toBeGreaterThanOrEqual(bounds.left - 0.5);
  expect(box.top).toBeGreaterThanOrEqual(bounds.top - 0.5);
  expect(box.right).toBeLessThanOrEqual(bounds.right + 0.5);
  expect(box.bottom).toBeLessThanOrEqual(bounds.bottom + 0.5);
}

test.describe("menus", () => {
  test("a tab's menu works from the keyboard: rows, type-ahead, a submenu in and out, Escape and focus return", async ({ desktop }) => {
    await desktop.useSuiteViewportAsync();
    const window = desktop.window;
    const notes = tab(window, "view/notes.list");
    await notes.focus();
    await window.keyboard.press("Shift+F10");

    await expect(menus(window)).toHaveCount(1);
    await expect.poll(() => focusedLabel(window)).toBe("Move to");
    await window.keyboard.press("End");
    await expect.poll(() => focusedLabel(window)).toBe("Reset the layout");
    await window.keyboard.press("Home");
    await expect.poll(() => focusedLabel(window)).toBe("Move to");
    await window.keyboard.press("ArrowDown");
    await window.keyboard.press("ArrowDown");
    await expect.poll(() => focusedLabel(window)).toBe("Dock");

    await window.keyboard.press("ArrowRight");
    await expect(menus(window)).toHaveCount(2);
    await expect.poll(() => focusedLabel(window)).toBe("Dock left");
    const parent = await boxOf(menus(window).first());
    const child = await boxOf(menus(window).last());
    const row = await boxOf(menus(window).first().getByRole("menuitem", { name: "Dock", exact: true }));
    const firstChildRow = await boxOf(menus(window).last().getByRole("menuitem").first());
    expect(Math.abs(child.left - parent.right)).toBeLessThan(1);
    expect(Math.abs(firstChildRow.top - row.top)).toBeLessThan(1);

    await window.keyboard.press("ArrowLeft");
    await expect(menus(window)).toHaveCount(1);
    await expect.poll(() => focusedLabel(window)).toBe("Dock");
    await window.keyboard.press("c");
    await expect.poll(() => focusedLabel(window)).toBe("Close");
    await window.keyboard.press("Escape");

    await expect(menus(window)).toHaveCount(0);
    await expect(notes).toBeFocused();
  });

  test("a menu at the window's right edge ends at its trigger, flips its submenu to the left, stays within the bounds and closes on a click outside", async ({ desktop }) => {
    await desktop.useSuiteViewportAsync();
    const window = desktop.window;
    const actions = window.locator("tr-tab-group[data-side=Right] .tr-tab-group-menu").first();
    await actions.click();
    await expect(menus(window)).toHaveCount(1);
    await menus(window).getByRole("menuitem", { name: "Dock", exact: true }).click();
    await expect(menus(window)).toHaveCount(2);

    const bounds = await boundsOf(window);
    const trigger = await boxOf(actions);
    const parent = await boxOf(menus(window).first());
    const child = await boxOf(menus(window).last());
    expect(Math.abs(parent.right - trigger.right)).toBeLessThan(1);
    expect(parent.top).toBeGreaterThanOrEqual(trigger.bottom - 0.5);
    expect(Math.abs(child.right - parent.left)).toBeLessThan(1);
    expectInside(parent, bounds);
    expectInside(child, bounds);
    expect(await menus(window).evaluateAll(list => list.every(t => t.scrollWidth <= t.clientWidth))).toBe(true);

    await window.locator(`${documentsGroup} [role=tabpanel]`).click({ position: { x: 200, y: 200 } });
    await expect(menus(window)).toHaveCount(0);
  });

  test("the overflow list starts with Close all, lists every document, marks the current one, scrolls within 20 rows and shows a cut title in a tooltip", async ({ desktop }) => {
    await desktop.useSuiteViewportAsync();
    const window = desktop.window;
    await expect(window.locator(`${documentsGroup} tr-tab`)).toHaveCount(50);
    const selected = await window.locator(`${documentsGroup} tr-tab[aria-selected=true]`).getAttribute("data-tab-key");
    await window.locator(`${documentsGroup} .tr-tab-group-overflow`).click();
    const list = menus(window);
    await expect(list).toHaveCount(1);

    const rows = list.locator(".tr-tab-group-overflow-tab");
    await expect(rows).toHaveCount(50);
    await expect(list.locator(":scope > *").nth(0).locator(".tr-menu-item-label")).toHaveText("Close all");
    await expect(list.locator(":scope > *").nth(1)).toHaveRole("separator");
    await expect(list.locator(".tr-tab-group-overflow-tab[aria-current=true]")).toHaveAttribute("data-tab", selected ?? "");
    const shape = await list.evaluate(t => {
      const style = getComputedStyle(t);
      const row = (t.querySelector(".tr-tab-group-overflow-tab") as HTMLElement).offsetHeight;
      const frame = Number.parseFloat(style.paddingTop) * 2 + Number.parseFloat(style.borderTopWidth) * 2;
      return { height: t.getBoundingClientRect().height, cap: Math.min(innerHeight * 0.6, row * 20 + frame), scrolls: t.scrollHeight > t.clientHeight, across: t.scrollWidth > t.clientWidth };
    });
    expect(shape.height).toBeLessThanOrEqual(shape.cap + 0.5);
    expect([shape.scrolls, shape.across]).toEqual([true, false]);
    expectInside(await boxOf(list), await boundsOf(window));

    const tooltip = window.locator(".cdk-overlay-container tr-tooltip");
    const longRow = rows.filter({ has: window.locator(".tr-menu-item-label", { hasText: keyboardTitle }) });
    await longRow.scrollIntoViewIfNeeded();
    await longRow.hover();
    await expect(tooltip).toHaveText(keyboardTitle);
    await expect.poll(async () => {
      const tip = await boxOf(tooltip);
      const row = await boxOf(longRow);
      const isApart = tip.left >= row.right - 0.5 || tip.right <= row.left + 0.5 || tip.top >= row.bottom - 0.5 || tip.bottom <= row.top + 0.5;
      return isApart ? "apart" : JSON.stringify({ tip, row, width: await window.evaluate(() => innerWidth) });
    }).toBe("apart");
    const shortRow = rows.filter({ has: window.locator(".tr-menu-item-label", { hasText: /^Fonts$/ }) });
    await shortRow.scrollIntoViewIfNeeded();
    await shortRow.hover();
    await expect(tooltip).toHaveCount(0);
    expect(await shortRow.locator(".tr-menu-item-label").evaluate(t => t.scrollWidth <= t.clientWidth)).toBe(true);

    await longRow.click();
    await expect(list).toHaveCount(0);
    const chosen = window.locator(`${documentsGroup} tr-tab[aria-label="${keyboardTitle}"]`);
    await expect(chosen).toHaveAttribute("aria-selected", "true");
    await expect(chosen).toBeFocused();
    const strip = await boxOf(window.locator(`${documentsGroup} .tr-tab-group-scroller`));
    const shown = await boxOf(chosen);
    expect(shown.left).toBeGreaterThanOrEqual(strip.left - 0.5);
    expect(shown.right).toBeLessThanOrEqual(strip.right + 0.5);
  });

  test("in a short window the overflow list stays between the window row and the status bar and scrolls under a thin scrollbar", async ({ desktop }) => {
    await desktop.useViewportAsync(1100, 400);
    const window = desktop.window;
    await window.locator(`${documentsGroup} .tr-tab-group-overflow`).click();
    const list = menus(window);
    await expect(list).toHaveCount(1);

    expectInside(await boxOf(list), await boundsOf(window));
    const scrollbar = await list.evaluate(t => ({ scrolls: t.scrollHeight > t.clientHeight, width: t.getBoundingClientRect().width - t.clientWidth - Number.parseFloat(getComputedStyle(t).borderLeftWidth) * 2 }));
    expect(scrollbar).toEqual({ scrolls: true, width: 6 });
  });
});
