/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect } from "playwright/test";

import { CodexDouble } from "./fixtures/codex-double.ts";
import { test } from "./fixtures/teamrun-app.fixture.ts";

const LINES: number = 12;
const SENDS: number = 3;

test.describe("the composer", () => {
  test("sends tall messages one after another, its field shrinking each time, with no ResizeObserver loop error in the window", async ({ app }) => {
    const page = await app.openChatAsync();
    await page.evaluate(() => {
      const errors: string[] = [];
      (globalThis as Record<string, unknown>)["composerErrors"] = errors;
      window.addEventListener("error", event => errors.push(event.message));
    });
    const field = page.getByRole("combobox", { name: "Message", exact: true });

    for (let send = 1; send <= SENDS; send++) {
      const last = `Line ${LINES} of message ${send}.`;
      await app.sendAsync([`${CodexDouble.REPLY_PREFIX}Answer ${send}`, ...Array.from({ length: LINES }, (_, t) => `Line ${t + 1} of message ${send}.`)].join("\n"));
      await expect(page.getByText(last)).toHaveCount(2, { timeout: 60_000 });
      await expect(field).toHaveValue("");
    }
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    expect(await page.evaluate(() => (globalThis as Record<string, unknown>)["composerErrors"])).toEqual([]);
    expect(app.unexpectedFailures).toEqual([]);
  });
});
