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

const documentsGroup = "tr-tab-group:has(tr-tab[data-tab-key='document/notes.note/1'])";
const bottomGroup = "tr-tab-group:has(tr-tab[data-tab-key='view/notes.terminal'])";
const architectureTitle = "Shell architecture review: the module contract, runtime boundaries and what the window may cache between restarts";

test.use({ desktopDataFiles: { "modules/notes/many-tabs": "" } });

function tooltip(window: Page): Locator {
  return window.locator(".cdk-overlay-container tr-tooltip");
}

function boxOf(locator: Locator): Promise<Readonly<Record<"left" | "top" | "right" | "bottom" | "width", number>>> {
  return locator.evaluate(t => {
    const box = t.getBoundingClientRect();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width };
  });
}

test.describe("the window's look", () => {
  test("tabs stop at 16rem and show a cut title in full in a tooltip below, but not a whole one", async ({ desktop }) => {
    const window = desktop.window;
    const long = window.locator(`${documentsGroup} tr-tab[aria-label="${architectureTitle}"]`);
    const short = window.locator(`${documentsGroup} tr-tab[aria-label="Bugs"]`);
    await long.scrollIntoViewIfNeeded();

    const shape = await long.evaluate(t => {
      const label = t.querySelector(".tr-tab-label") as HTMLElement;
      return { width: t.getBoundingClientRect().width, rem: Number.parseFloat(getComputedStyle(document.documentElement).fontSize), isCut: label.scrollWidth > label.clientWidth };
    });
    expect(shape.width).toBeLessThanOrEqual(16 * shape.rem + 0.5);
    expect(shape.isCut).toBe(true);
    await long.hover();
    await expect(tooltip(window)).toHaveText(architectureTitle);
    expect((await boxOf(tooltip(window))).top).toBeGreaterThan((await boxOf(long)).bottom);

    await short.scrollIntoViewIfNeeded();
    await short.hover();
    await expect(tooltip(window)).toHaveCount(0);
    expect(await short.locator(".tr-tab-label").evaluate(t => t.scrollWidth <= t.clientWidth)).toBe(true);
    await desktop.checkpointAsync("window-look-tabs");
  });

  test("a collapsed dock names its views in tooltips beside its strip", async ({ desktop }) => {
    const window = desktop.window;
    await window.locator("tr-tab-group[data-side=Left] .tr-tab-group-hide").click();
    const strip = window.locator(".tr-dock-strip").first();
    await expect(strip).toBeVisible();
    const view = strip.locator(".tr-dock-strip-view").first();

    await view.hover();

    await expect(tooltip(window)).toHaveText(await view.getAttribute("aria-label") ?? "");
    expect((await boxOf(tooltip(window))).left).toBeGreaterThanOrEqual((await boxOf(strip)).right);
  });

  test("scroll areas have 0.375rem scrollbars whose thumb shows only while hovered, without moving their content", async ({ desktop }) => {
    const window = desktop.window;
    const content = window.locator(`${documentsGroup} tr-tab-content`);
    const scroller = window.locator(`${documentsGroup} .tr-tab-group-scroller`);

    const area = await ScrollAreaFixture.scrollbarSizesAsync(content);
    const strip = await ScrollAreaFixture.scrollbarSizesAsync(scroller);
    const quietStrip = await ScrollAreaFixture.scrollbarSizesAsync(window.locator(`${bottomGroup} .tr-tab-group-scroller`));
    expect(area.vertical).toBeCloseTo(0.375 * area.rem, 0);
    expect(strip.horizontal).toBeCloseTo(0.375 * strip.rem, 0);
    expect(quietStrip.horizontal).toBeCloseTo(0.375 * strip.rem, 0);
    const before = await boxOf(content.locator("h1"));
    expect(await ScrollAreaFixture.thumbChangesOnHoverAsync(window, content, "vertical")).toBe(true);
    expect(await boxOf(content.locator("h1"))).toEqual(before);
    expect(await ScrollAreaFixture.thumbChangesOnHoverAsync(window, scroller, "horizontal")).toBe(true);
  });

  test("a heading that wraps keeps its lines apart", async ({ desktop }) => {
    await desktop.useViewportAsync(900, 700);
    const window = desktop.window;
    await window.locator(`${documentsGroup} tr-tab[aria-label="${architectureTitle}"]`).click();
    const heading = window.locator(`${documentsGroup} h1`, { hasText: architectureTitle });
    await expect(heading).toHaveText(architectureTitle);

    const lines = await heading.evaluate(t => {
      const range = document.createRange();
      range.selectNodeContents(t);
      const tops = [...new Set([...range.getClientRects()].map(r => Math.round(r.top)))];
      const style = getComputedStyle(t);
      return { tops, lineHeight: Number.parseFloat(style.lineHeight), fontSize: Number.parseFloat(style.fontSize) };
    });

    expect(lines.tops.length).toBeGreaterThan(1);
    expect(lines.lineHeight).toBeGreaterThanOrEqual(lines.fontSize * 1.2);
    expect(lines.tops.slice(1).every((top, index) => top - (lines.tops[index] ?? 0) >= lines.fontSize)).toBe(true);
  });

  test("pads a page 0.75rem across, starting its content on its first tab's icon, a document's 1rem down and a docked view's 0.5rem, but not a view that turns it off", async ({ desktop }) => {
    const window = desktop.window;
    const expectPaddingAsync = async (tab: string, page: string, padding: readonly number[], isOnIcon: boolean): Promise<void> => {
      await window.locator(`tr-tab[data-tab-key='${tab}']`).click();
      const group = window.locator(`tr-tab-group:has(tr-tab[data-tab-key='${tab}'])`);
      const content = group.locator("tr-tab-content");
      await expect(content.locator(page)).toBeVisible();
      await expect.poll(() => group.evaluate(t => {
        const host = t.querySelector("tr-tab-content") as HTMLElement;
        const style = getComputedStyle(host);
        const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
        const contentStart = host.getBoundingClientRect().left + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft);
        const icon = (t.querySelector("tr-tab .tr-tab-icon") as HTMLElement).getBoundingClientRect().left + (t.querySelector(".tr-tab-group-scroller") as HTMLElement).scrollLeft;
        return [...[style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(p => Math.round(Number.parseFloat(p) / rem * 1000) / 1000), Math.round(contentStart - icon) === 0];
      })).toEqual([...padding, isOnIcon]);
    };

    await expectPaddingAsync("document/notes.note/1", "tr-notes-note", [1, 0.75, 1, 0.75], true);
    await expectPaddingAsync("view/clock.face", "tr-clock-face", [0.5, 0.75, 0.5, 0.75], true);
    await expectPaddingAsync("view/notes.outline", "tr-notes-outline", [0, 0, 0, 0], false);
  });
});
