/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect } from "playwright/test";

import { test } from "./fixtures/teamrun-app.fixture.ts";

test("probe: the window's clock against the main process's", async ({ app }) => {
  const page = await app.startAsync();
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible({ timeout: 30_000 });
  const samples = await app.electronApp.evaluate(async ({ webContents }, address) => {
    const window = webContents.getAllWebContents().find(t => t.getURL() === address);
    if (Object.isUndefined(window))
      throw new Error(`No web contents shows ${address}.`);
    const found: { before: number; window: number; after: number }[] = [];
    for (let index = 0; index < 200; index++) {
      const before = performance.timeOrigin + performance.now();
      const at = Number(await window.executeJavaScript("performance.timeOrigin + performance.now()"));
      const after = performance.timeOrigin + performance.now();
      found.push({ before, window: at, after });
    }
    return found;
  }, page.url());
  const sorted = [...samples].sort((a, b) => (a.after - a.before) - (b.after - b.before));
  const best = sorted.slice(0, 20).map(t => ({ trip: t.after - t.before, offset: t.window - (t.before + t.after) / 2, low: t.window - t.after, high: t.window - t.before }));
  const low = Math.max(...samples.map(t => t.window - t.after));
  const high = Math.min(...samples.map(t => t.window - t.before));
  process.stdout.write(`PROBE-CLOCK ${process.platform}-${process.arch} window minus main: bounded to [${low.toFixed(3)}, ${high.toFixed(3)}] ms; `
    + `best trips ${JSON.stringify(best.slice(0, 5).map(t => `${t.trip.toFixed(3)}:${t.offset.toFixed(3)}`))}\n`);
});
