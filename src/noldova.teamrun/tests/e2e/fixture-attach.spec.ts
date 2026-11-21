/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect } from "playwright/test";

import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

async function refuseLeaveAsync(app: TeamRunApp): Promise<string> {
  const page = await app.startAsync();
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible({ timeout: 30_000 });
  const address = page.url();
  await app.electronApp.evaluate(({ webContents }, shown) => {
    const contents = webContents.getAllWebContents().find(t => t.getURL() === shown);
    Object.assign(globalThis, { windowLeave: contents === undefined ? "no window" : "pending" });
    contents?.on("will-navigate", event => Object.assign(globalThis, { windowLeave: event.defaultPrevented ? "refused" : "allowed" }));
    void contents?.executeJavaScript("location.href = 'https://example.com/'; true");
  }, address);
  await expect.poll(() => app.electronApp.evaluate(() => String(Reflect.get(globalThis, "windowLeave"))), TeamRunApp.pollOf(30_000)).toBe("refused");
  return address;
}

test("reads a window's tree at teardown at once after the window refused a navigation, which Playwright otherwise waits on until the snapshot's limit",
  async ({ app }, testInfo) => {
    const address = await refuseLeaveAsync(app);

    await app.attachAsync(testInfo, false);
    const tree = String(testInfo.attachments.find(t => t.name === "window-0.txt")?.body ?? "");

    expect([tree.split("\n")[0], tree.includes("button \"Settings\""), tree.includes("TimeoutError")]).toEqual([address, true, false]);
  });

test("reads the main window's tree for a test's own snapshot at once after the window refused a navigation", async ({ app }, testInfo) => {
  await refuseLeaveAsync(app);

  await app.snapshotAsync(testInfo, "after-leave");
  const tree = String(testInfo.attachments.find(t => t.name === "after-leave.txt")?.body ?? "");

  expect([tree.includes("button \"Settings\""), tree.includes("TimeoutError")]).toEqual([true, false]);
});
