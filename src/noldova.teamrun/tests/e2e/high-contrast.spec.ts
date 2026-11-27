/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Page, expect } from "playwright/test";

import { SystemContrast } from "./fixtures/system-contrast.ts";
import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

const VARIABLE = "TEAMRUN_E2E_HIGH_CONTRAST";
const ON = 1;
const SCHEME = "High Contrast Black";

const lookAsync = (page: Page): Promise<{ readonly forced: boolean; readonly inSystemColours: boolean }> => page.evaluate(() => {
  const sample = document.body.appendChild(document.createElement("div"));
  sample.style.setProperty("background-color", "Canvas");
  sample.style.setProperty("color", "CanvasText");
  const [body, system] = [getComputedStyle(document.body), getComputedStyle(sample)];
  const inSystemColours = body.backgroundColor === system.backgroundColor && body.color === system.color;
  sample.remove();
  return { forced: matchMedia("(forced-colors: active)").matches, inSystemColours };
});

test.describe("Windows High Contrast", () => {
  let saved: SystemContrast | null = null;

  test.afterEach(() => {
    if (saved !== null)
      SystemContrast.apply(saved);
    saved = null;
  });

  test("turns forced colours on in the system's colours when the system setting turns on, and off when it turns off", async ({ app }) => {
    test.skip(process.platform !== "win32" || process.env[VARIABLE] !== "1", `Windows only, with ${VARIABLE}=1, since it changes the system's contrast setting`);
    const before = SystemContrast.apply(null);
    saved = before;
    const page = await app.startAsync();
    await page.emulateMedia({ forcedColors: null, colorScheme: null, contrast: null });
    expect(SystemContrast.apply(new SystemContrast(before.flags | ON, before.scheme.length > 0 ? before.scheme : SCHEME)).flags & ON).toBe(ON);
    await expect.poll(() => lookAsync(page), TeamRunApp.pollOf()).toEqual({ forced: true, inSystemColours: true });
    expect(SystemContrast.apply(new SystemContrast(before.flags & ~ON, before.scheme)).flags & ON).toBe(0);
    await expect.poll(async () => (await lookAsync(page)).forced, TeamRunApp.pollOf()).toBe(false);
  });
});
