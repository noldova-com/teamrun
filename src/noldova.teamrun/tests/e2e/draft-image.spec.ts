/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdirSync } from "node:fs";

import { expect } from "playwright/test";

import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

const PIXEL: Buffer = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test.describe("an unsent message's image", () => {
  test("previews again after the page reloads, loaded from its desktop-file share under the window's policy", async ({ app }) => {
    const page = await app.openChatAsync();
    await page.locator("input[type=file]").setInputFiles({ name: "pixel.png", mimeType: "image/png", buffer: PIXEL });
    await expect(page.locator(".nol-teamrun-composer-preview")).toHaveCount(1, { timeout: 30_000 });
    await expect.poll(() => readdirSync(app.dataFolder, { recursive: true, encoding: "utf8" }).some(t => t.includes("draft-files") && t.endsWith(".png")),
      TeamRunApp.pollOf(30_000)).toBe(true);

    await page.reload();

    const preview = page.locator(".nol-teamrun-composer-preview");
    await expect(preview).toHaveAttribute("src", /^desktop-file:\/\/[0-9a-f]{32}\/$/, { timeout: 60_000 });
    await expect.poll(() => preview.evaluate((t: HTMLImageElement) => t.complete ? t.naturalWidth : -1), TeamRunApp.pollOf(30_000)).toBe(1);
    expect(app.unexpectedFailures).toEqual([]);
  });
});
