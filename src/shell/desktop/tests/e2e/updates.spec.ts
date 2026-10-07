/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";

import BuildVariantFixture from "./fixtures/build-variant.fixture.ts";
import CleanupSteps from "./fixtures/cleanup-steps.ts";
import DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import ReadyUpdateFixture from "./fixtures/ready-update.fixture.ts";
import UpdateFeedFixture from "./fixtures/update-feed.fixture.ts";

test("an update made ready before TeamRun started offers Restart to update at once, without asking the feed again", async ({}, testInfo) => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "teamrun-updates-"));
  const device = path.join(folder, "device");
  const cache = path.join(folder, "cache");
  const contents = Buffer.from("TeamRun 999.0.0");
  let feed: UpdateFeedFixture | null = null;
  let desktop: DesktopApplicationFixture | null = null;
  let failure: { readonly error: unknown } | null = null;
  try {
    await BuildVariantFixture.swapInAsync(UpdateFeedFixture.VARIANT);
    feed = await UpdateFeedFixture.startAsync(path.join(folder, "feed"));
    await feed.publishAsync("999.0.0", contents);
    await ReadyUpdateFixture.seedAsync(device, cache, "999.0.0", contents);
    desktop = await DesktopApplicationFixture.launchAsync(testInfo, ReadyUpdateFixture.environment(cache), {}, [], false, device);
    const page = desktop.window;

    await expect(page.locator(".tr-update-item")).toHaveText(/Restart to update$/);
    expect(feed.requests).toEqual([]);
    expect(await page.evaluate(async () => (await (window as unknown as { teamrun: { readUpdate(): Promise<{ kind: string; version: string | null }> } }).teamrun.readUpdate())))
      .toEqual(expect.objectContaining({ kind: "Ready", version: "999.0.0" }));
  }
  catch (error) {
    failure = { error };
  }
  const cleanup = await CleanupSteps.collectFailuresAsync([
    async () => {
      await desktop?.disposeAsync();
    },
    async () => {
      await feed?.disposeAsync();
    },
    () => BuildVariantFixture.restoreAsync(),
    () => rm(folder, { recursive: true, force: true, maxRetries: 10 })
  ]);
  await CleanupSteps.attachAsync(testInfo, cleanup);
  if (failure !== null)
    throw failure.error;
  CleanupSteps.throwFailures(cleanup);
  expect(desktop?.failures).toEqual([]);
});
