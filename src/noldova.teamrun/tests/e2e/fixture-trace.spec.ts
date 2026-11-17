/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, statSync } from "node:fs";

import { expect } from "playwright/test";

import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

test.describe("the end-to-end fixture's trace", () => {
  test.use({ isAppTraced: true });

  test("is kept as trace.zip in a failed test's results, once", async ({ app }, testInfo) => {
    const page = await app.startAsync();
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible({ timeout: 30_000 });
    const file = testInfo.outputPath("trace.zip");

    await app.keepTraceAsync(testInfo, true);
    const size = statSync(file).size;
    await app.keepTraceAsync(testInfo, true);

    expect(size).toBeGreaterThan(0);
    expect(statSync(file).size).toBe(size);
  });

  test("is kept from the app's next start after the test quit it", async ({ app }, testInfo) => {
    await expect((await app.startAsync()).getByRole("button", { name: "Settings", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => app.run(["status", "--json"]), TeamRunApp.pollOf(30_000)).toMatch(/^0 /);
    expect(app.quit()).toContain("\"outcome\":\"Quit\"");
    expect(await app.waitForExitAsync()).toBe(0);
    const restarted = await app.startAsync();
    await expect(restarted.getByRole("button", { name: "Settings", exact: true })).toBeVisible({ timeout: 30_000 });

    await app.keepTraceAsync(testInfo, true);

    expect(statSync(testInfo.outputPath("trace.zip")).size).toBeGreaterThan(0);
  });

  test("is dropped after a test that passed", async ({ app }, testInfo) => {
    const page = await app.startAsync();
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible({ timeout: 30_000 });

    await app.keepTraceAsync(testInfo, false);

    expect(existsSync(testInfo.outputPath("trace.zip"))).toBe(false);
  });
});

test.describe("an app the spec doesn't trace", () => {
  test("keeps no trace, even after a failed test", async ({ app }, testInfo) => {
    const page = await app.startAsync();
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible({ timeout: 30_000 });

    await app.keepTraceAsync(testInfo, true);

    expect(existsSync(testInfo.outputPath("trace.zip"))).toBe(false);
  });
});
