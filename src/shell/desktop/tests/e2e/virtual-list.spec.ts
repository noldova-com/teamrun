/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page, TestInfo } from "@playwright/test";

import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import SettingsFixture from "./fixtures/settings.fixture.ts";

interface IFrameRecord {
  readonly gaps: readonly number[];
  readonly longFrames: readonly number[] | null;
  readonly rows: readonly number[];
  readonly drift: readonly number[];
}

interface ITimingSummary {
  readonly frames: number;
  readonly medianGap: number;
  readonly p95Gap: number;
  readonly longestGap: number;
  readonly longAnimationFrames: number | null;
  readonly longestAnimationFrame: number | null;
}

function list(window: Page, selector: string): Locator {
  return window.locator(`tr-gallery .tr-gallery-scope-frame[data-mode="Light"] ${selector}`).first();
}

function viewport(target: Locator): Locator {
  return target.locator(".tr-virtual-list-viewport");
}

function percentile(values: readonly number[], share: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))] ?? 0;
}

function summarize(record: IFrameRecord): ITimingSummary {
  const round = (t: number): number => Math.round(t * 10) / 10;
  return {
    frames: record.gaps.length,
    medianGap: round(percentile(record.gaps, 0.5)),
    p95Gap: round(percentile(record.gaps, 0.95)),
    longestGap: round(Math.max(0, ...record.gaps)),
    longAnimationFrames: record.longFrames?.length ?? null,
    longestAnimationFrame: record.longFrames === null ? null : round(Math.max(0, ...record.longFrames))
  };
}

async function scrollFramesAsync(target: Locator, steps: number, delta: number, anchor: number | null): Promise<IFrameRecord> {
  return viewport(target).evaluate(async (element, [count, step, place]) => {
    const isSupported = PerformanceObserver.supportedEntryTypes.includes("long-animation-frame");
    const longFrames: number[] = [];
    const observer = new PerformanceObserver(t => longFrames.push(...t.getEntries().map(u => u.duration)));
    if (isSupported)
      observer.observe({ type: "long-animation-frame" });
    const offsetOf = (): number => {
      const row = element.querySelector(`[aria-posinset="${place}"]`);
      return row === null ? Number.NaN : row.getBoundingClientRect().top - element.getBoundingClientRect().top;
    };
    const start = offsetOf();
    const gaps: number[] = [];
    const rows: number[] = [];
    const drift: number[] = [];
    let last = performance.now();
    for (let frame = 0; frame < count; frame++) {
      element.scrollTop += step;
      await new Promise<number>(t => requestAnimationFrame(t));
      const now = performance.now();
      gaps.push(now - last);
      last = now;
      rows.push(element.querySelectorAll("[data-tr-row]").length);
      if (place !== null)
        drift.push(Math.abs(offsetOf() - start));
    }
    observer.disconnect();
    return { gaps, longFrames: isSupported ? longFrames : null, rows, drift };
  }, [steps, delta, anchor] as const);
}

async function rowBoundAsync(target: Locator): Promise<number> {
  return viewport(target).evaluate(element => {
    const heights = [...element.querySelectorAll("[data-tr-row]")].map(t => t.getBoundingClientRect().height).filter(t => t > 0);
    return Math.ceil((element.clientHeight + 2 * 600) / Math.min(...heights)) + 2;
  });
}

async function endDistanceAsync(target: Locator): Promise<number> {
  return viewport(target).evaluate(element => element.scrollHeight - element.clientHeight - element.scrollTop);
}

async function attachAsync(testInfo: TestInfo, window: Page, timings: Readonly<Record<string, ITimingSummary>>): Promise<void> {
  const conditions = await window.evaluate(() => ({ width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio, userAgent: navigator.userAgent }));
  await testInfo.attach("frame-timings.json", {
    body: JSON.stringify({ platform: process.platform, arch: process.arch, conditions, timings }, null, 2),
    contentType: "application/json"
  });
}

test.describe("virtual list", () => {
  test("the Gallery's 10,000-row options list renders only the rows around its view while it scrolls from end to end, and records its frame timings", async ({ desktop }, testInfo) => {
    const window = desktop.window;
    await SettingsFixture.openGalleryAsync(window);
    const options = list(window, "tr-gallery-navigation .tr-gallery-list");
    await options.scrollIntoViewIfNeeded();
    await expect(options.locator("[role=option]").first()).toHaveAttribute("aria-setsize", "10000");
    const bound = await rowBoundAsync(options);

    const down = await scrollFramesAsync(options, 120, 2500, null);
    const up = await scrollFramesAsync(options, 120, -2500, null);
    await desktop.checkpointAsync("virtual-list-options");
    await attachAsync(testInfo, window, { down: summarize(down), up: summarize(up) });

    expect(Math.max(...down.rows, ...up.rows)).toBeLessThanOrEqual(bound);
    await expect(options.locator("[role=option][aria-posinset=\"1\"]")).toBeVisible();
  });

  test("the Gallery's 10,000-message feed opens at its end, keeps the end in place while a reply streams, and keeps the row being read in place while older messages load above it", async ({ desktop }, testInfo) => {
    const window = desktop.window;
    await SettingsFixture.openGalleryAsync(window);
    const feed = list(window, "tr-gallery-feed .tr-gallery-feed-list");
    await feed.scrollIntoViewIfNeeded();
    await expect(feed.locator("[role=article][aria-posinset=\"10000\"]")).toBeVisible();
    await expect.poll(() => endDistanceAsync(feed)).toBeLessThanOrEqual(1);

    await list(window, "tr-gallery-feed button.tr-button").click();
    const streaming = await viewport(feed).evaluate(async element => {
      const distances: (readonly number[])[] = [];
      const words: number[] = [];
      const wordsOf = (): number => (element.querySelector("[aria-posinset=\"10001\"] .tr-gallery-message-text")?.textContent ?? "").split(" ").length;
      const shapes: string[] = [];
      while (words.at(-1) !== 40 && words.length < 1200) {
        await new Promise<number>(t => requestAnimationFrame(t));
        words.push(wordsOf());
        shapes.push(`${words.at(-1)} ${element.scrollHeight} ${element.querySelectorAll("[data-tr-row]").length}`);
        const settled = shapes.length > 2 && shapes.at(-1) === shapes.at(-2) && shapes.at(-2) === shapes.at(-3);
        if (settled)
          distances.push([words.length, words.at(-1) ?? 0, element.scrollHeight - element.clientHeight - element.scrollTop, element.scrollTop, element.scrollHeight]);
      }
      return { words: words.at(-1), distances };
    });
    const following = await endDistanceAsync(feed);

    const history = await scrollFramesAsync(feed, 200, -80, null);
    const reading = await viewport(feed).evaluate(element => {
      const top = element.getBoundingClientRect().top;
      const row = [...element.querySelectorAll("[role=article]")].find(t => t.getBoundingClientRect().bottom > top);
      return Number(row?.getAttribute("aria-posinset"));
    });
    const trace = await viewport(feed).evaluate(async (element, place) => {
      const records: string[] = [];
      const row = (): Element | null => element.querySelector(`[aria-posinset="${place}"]`);
      const rows = element.querySelector(".tr-virtual-list-rows") as HTMLElement;
      const offset = (): number => Math.round((row()?.getBoundingClientRect().top ?? 0) - element.getBoundingClientRect().top);
      const start = offset();
      let changed = -1;
      for (let frame = 0; frame < 150 && (changed < 0 || frame < changed + 4); frame++) {
        const slots = [...element.querySelectorAll<HTMLElement>("[data-tr-row]")];
        records.push(`${frame} st=${element.scrollTop} sh=${element.scrollHeight} off=${offset()} pt=${getComputedStyle(rows).paddingTop} first=${slots[0]?.dataset["trRow"]} n=${slots.length} hidden=${slots.filter(t => t.firstElementChild?.getAttribute("aria-hidden") === "true").length}`);
        if (changed < 0 && Math.abs(offset() - start) > 1)
          changed = frame;
        await new Promise<number>(t => requestAnimationFrame(t));
      }
      return records.slice(Math.max(0, changed - 3));
    }, reading);
    const loading = { gaps: [], longFrames: null, rows: [], drift: [0] };
    await desktop.checkpointAsync("virtual-list-feed");
    await attachAsync(testInfo, window, { history: summarize(history), loading: summarize(loading) });

    expect([streaming.words, streaming.distances.filter(t => (t[2] ?? 0) > 1), streaming.distances.length > 0, following <= 1]).toEqual([40, [], true, true]);
    expect([reading, trace]).toEqual([]);
  });
});
