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

function scrollbarOf(locator: Locator): Promise<Readonly<Record<"vertical" | "horizontal" | "rem", number>>> {
  return locator.evaluate(t => {
    const element = t as HTMLElement;
    const style = getComputedStyle(element);
    return {
      vertical: element.offsetWidth - element.clientWidth - Number.parseFloat(style.borderLeftWidth) - Number.parseFloat(style.borderRightWidth),
      horizontal: element.offsetHeight - element.clientHeight - Number.parseFloat(style.borderTopWidth) - Number.parseFloat(style.borderBottomWidth),
      rem: Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
    };
  });
}

async function thumbChangesOnHoverAsync(window: Page, area: Locator, axis: "vertical" | "horizontal"): Promise<boolean> {
  const clip = await area.evaluate((t, direction) => {
    const element = t as HTMLElement;
    const box = element.getBoundingClientRect();
    const left = box.left + element.clientLeft;
    const top = box.top + element.clientTop;
    return direction === "vertical"
      ? { x: left + element.clientWidth, y: top, width: element.offsetWidth - element.clientWidth - element.clientLeft * 2, height: element.clientHeight }
      : { x: left, y: top + element.clientHeight, width: element.clientWidth, height: element.offsetHeight - element.clientHeight - element.clientTop * 2 };
  }, axis);
  const thumbColor = (): Promise<string> => area.evaluate(t => getComputedStyle(t).color);
  const shown = await window.evaluate(() => {
    const probe = document.body.appendChild(document.createElement("div"));
    probe.style.color = "var(--tr-scrollbar)";
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  await window.mouse.move(1, 1);
  await expect.poll(thumbColor).toBe("rgba(0, 0, 0, 0)");
  const rest = await window.screenshot({ clip });
  await area.hover({ position: { x: 20, y: 10 } });
  await expect.poll(thumbColor).toBe(shown);
  return !rest.equals(await window.screenshot({ clip }));
}

test.describe("the window's look", () => {
  test("tabs stop at 16rem and show a cut title in full in a tooltip below, but not a whole one", async ({ desktop }) => {
    await desktop.useSuiteViewportAsync();
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
  });

  test("a collapsed dock names its views in tooltips beside its strip", async ({ desktop }) => {
    await desktop.useSuiteViewportAsync();
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
    await desktop.useSuiteViewportAsync();
    const window = desktop.window;
    const content = window.locator(`${documentsGroup} tr-tab-content`);
    const scroller = window.locator(`${documentsGroup} .tr-tab-group-scroller`);

    const area = await scrollbarOf(content);
    const strip = await scrollbarOf(scroller);
    const quietStrip = await scrollbarOf(window.locator(`${bottomGroup} .tr-tab-group-scroller`));
    expect(area.vertical).toBeCloseTo(0.375 * area.rem, 0);
    expect(strip.horizontal).toBeCloseTo(0.375 * strip.rem, 0);
    expect(quietStrip.horizontal).toBeCloseTo(0.375 * strip.rem, 0);
    const before = await boxOf(content.locator("h1"));
    expect(await thumbChangesOnHoverAsync(window, content, "vertical")).toBe(true);
    expect(await boxOf(content.locator("h1"))).toEqual(before);
    expect(await thumbChangesOnHoverAsync(window, scroller, "horizontal")).toBe(true);
  });

  test("a heading that wraps keeps its lines apart", async ({ desktop }) => {
    await desktop.useViewportAsync(900, 700);
    const window = desktop.window;
    await window.locator(`${documentsGroup} tr-tab[aria-label="${architectureTitle}"]`).click();
    const heading = window.locator(`${documentsGroup} h1`);
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
});
