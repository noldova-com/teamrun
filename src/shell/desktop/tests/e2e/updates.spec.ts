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

import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

import BuildVariantFixture from "./fixtures/build-variant.fixture.ts";
import CleanupSteps from "./fixtures/cleanup-steps.ts";
import ClockWorkFixture from "./fixtures/clock-work.fixture.ts";
import DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import PageBridgeFixture, { type IUpdateState } from "./fixtures/page-bridge.fixture.ts";
import ReadyUpdateFixture from "./fixtures/ready-update.fixture.ts";
import SettingsFixture from "./fixtures/settings.fixture.ts";
import UpdateFeedFixture from "./fixtures/update-feed.fixture.ts";

interface IReadyUpdate {
  readonly feed: UpdateFeedFixture;
  readonly launchAsync: () => Promise<DesktopApplicationFixture>;
}

const VERSION = "999.0.0";
const NOT_AN_APP_IMAGE = "This copy of TeamRun doesn't run from an AppImage, so it can't install the update.";

const withReadyUpdateAsync = async (testInfo: TestInfo, run: (update: IReadyUpdate) => Promise<void>): Promise<void> => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "teamrun-updates-"));
  const device = path.join(folder, "device");
  const cache = path.join(folder, "cache");
  const contents = Buffer.from(`TeamRun ${VERSION}`);
  const desktops: DesktopApplicationFixture[] = [];
  let feed: UpdateFeedFixture | null = null;
  let failure: { readonly error: unknown } | null = null;
  try {
    await BuildVariantFixture.swapInAsync(UpdateFeedFixture.VARIANT);
    const started = await UpdateFeedFixture.startAsync(path.join(folder, "feed"));
    feed = started;
    await started.publishAsync(VERSION, contents);
    await ReadyUpdateFixture.seedAsync(device, cache, VERSION, contents);
    await run({
      feed: started,
      launchAsync: async () => {
        const desktop = await DesktopApplicationFixture.launchAsync(testInfo, ReadyUpdateFixture.environment(cache), {}, [], false, device);
        desktops.push(desktop);
        return desktop;
      }
    });
  }
  catch (error) {
    failure = { error };
  }
  const cleanup = await CleanupSteps.collectFailuresAsync([
    ...desktops.map(t => () => t.disposeAsync()),
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
  for (const desktop of desktops)
    expect(desktop.failures).toEqual([]);
};

const readUpdateAsync = (page: Page): Promise<IUpdateState> => PageBridgeFixture.evaluateAsync(page, t => t.readUpdate());

const expectNewRuntimeAsync = async (desktop: DesktopApplicationFixture, previous: number | undefined): Promise<void> => {
  await expect.poll(async () => {
    const current = await desktop.readRuntimeProcessIdAsync();
    return current !== undefined && current !== previous && DesktopApplicationFixture.isAlive(current);
  }, { timeout: 30_000 }).toBe(true);
  await expect.poll(async () => (await PageBridgeFixture.evaluateAsync(desktop.window, t => t.readStartup()))?.kind, { timeout: 30_000 }).toBe("Ready");
};

const acceptHandoffFailureAsync = async (desktop: DesktopApplicationFixture, reason: string): Promise<void> => {
  const logged = /^main: \S+ The update('s publisher check failed in \d+ ms\.$| failed: )/;
  const expected = process.platform === "win32"
    ? [/^main: \S+ The update's publisher check failed in \d+ ms\.$/, /^main: \S+ The update failed: The update's installer .+ is not signed by the publisher, so it was not started: /]
    : [/^main: \S+ The update failed: /];
  await expect.poll(() => desktop.failures.filter(t => logged.test(t)).length, { timeout: 10_000 }).toBe(expected.length);
  const accepted = desktop.acceptFailures(logged);
  expected.forEach((pattern, index) => expect(accepted[index]).toMatch(pattern));
  const tail = process.platform === "win32" ? reason.slice(reason.indexOf(": its signature is not valid ")) : reason;
  expect(accepted.at(-1)?.endsWith(tail), `${accepted.at(-1)} ends with ${tail}`).toBe(true);
};

const openAboutAsync = async (page: Page): Promise<Locator> => {
  await SettingsFixture.openPageAsync(page, "About");
  return page.getByRole("region", { name: "About TeamRun" });
};

test("an update made ready before TeamRun started offers Restart to update at once, without asking the feed again, on a Mac copy outside Applications only asks the person to move it, or on a Linux copy that is no AppImage fails with the reason, offers no restart, stops nothing and downloads nothing", async ({}, testInfo) => {
  await withReadyUpdateAsync(testInfo, async ({ feed, launchAsync }) => {
    const desktop = await launchAsync();
    const page = desktop.window;

    if (process.platform === "linux") {
      const runtime = await desktop.readRuntimeProcessIdAsync();
      await expect(page.locator(".tr-update-item")).toHaveText(/Update failed$/);
      expect(await readUpdateAsync(page)).toEqual(expect.objectContaining({ kind: "Failed", reason: NOT_AN_APP_IMAGE }));
      const about = await openAboutAsync(page);
      await expect(about.getByRole("status")).toContainText("The update failed.");
      await expect(about.locator(".tr-about-detail")).toHaveText(NOT_AN_APP_IMAGE);
      await expect(about.getByRole("button", { name: "Restart to update" })).toHaveCount(0);
      expect(await PageBridgeFixture.evaluateAsync(page, t => t.actOnUpdate("Restart"))).toBe(false);
      expect(feed.requests).not.toContain(UpdateFeedFixture.source.packageFile);
      expect(await desktop.readRuntimeProcessIdAsync()).toBe(runtime);
      expect(DesktopApplicationFixture.isAlive(runtime ?? 0)).toBe(true);
      expect(await desktop.isVisibleAsync()).toBe(true);
    }
    else if (process.platform === "darwin") {
      const runtime = await desktop.readRuntimeProcessIdAsync();
      await expect(page.locator(".tr-update-item")).toHaveText(/Move to Applications to update$/);
      expect(await readUpdateAsync(page)).toEqual(expect.objectContaining({ kind: "Available", version: VERSION, reason: null }));
      const about = await openAboutAsync(page);
      await expect(about.getByRole("status")).toHaveText(/ to Applications to get updates\.$/);
      await expect(about.getByRole("button", { name: "Restart to update" })).toHaveCount(0);
      expect(await PageBridgeFixture.evaluateAsync(page, t => t.actOnUpdate("Restart"))).toBe(false);
      expect(feed.requests).toEqual([]);
      expect(await desktop.readRuntimeProcessIdAsync()).toBe(runtime);
      expect(await desktop.isVisibleAsync()).toBe(true);
    }
    else {
      await expect(page.locator(".tr-update-item")).toHaveText(/Restart to update$/);
      expect(feed.requests).toEqual([]);
      expect(await readUpdateAsync(page)).toEqual(expect.objectContaining({ kind: "Ready", version: VERSION, reason: null }));
    }
  });
});

test("Restart to update asks first while work runs, changes nothing when the person cancels, and stops the work when they choose to", async ({}, testInfo) => {
  test.skip(process.platform === "linux", "The development app on Linux fails before it offers the restart; the first workflow covers it.");
  test.skip(process.platform === "darwin", "The development app on macOS runs outside Applications, where a ready update only shows as available; the first workflow covers it.");
  test.setTimeout(180_000);
  await withReadyUpdateAsync(testInfo, async ({ launchAsync }) => {
    const desktop = await launchAsync();
    const window = desktop.window;
    const runtime = await desktop.readRuntimeProcessIdAsync();
    await ClockWorkFixture.beginAsync(desktop);
    const about = await openAboutAsync(window);
    const asking = window.getByRole("dialog", { name: "Work is still running" });

    await about.getByRole("button", { name: "Restart to update" }).click();
    await expect(asking).toBeVisible();
    await expect(asking.getByRole("listitem")).toHaveText([new RegExp(`^${ClockWorkFixture.WORK} \\(.+\\)$`)]);
    await expect(asking.getByRole("button")).toHaveText(["Wait, then update", "Stop the work and update", "Cancel"]);
    await asking.getByRole("button", { name: "Cancel" }).click();
    await expect(asking).toHaveCount(0);
    expect(await readUpdateAsync(window)).toEqual(expect.objectContaining({ kind: "Ready", version: VERSION, reason: null }));
    expect(await desktop.readRuntimeProcessIdAsync()).toBe(runtime);
    expect(await ClockWorkFixture.readAsync(desktop.dataDirectory)).toEqual(expect.arrayContaining([ClockWorkFixture.WORK]));

    await about.getByRole("button", { name: "Restart to update" }).click();
    await asking.getByRole("button", { name: "Stop the work and update" }).click();

    await expect.poll(async () => (await readUpdateAsync(window)).reason, { timeout: 90_000 }).not.toBeNull();
    expect(DesktopApplicationFixture.isAlive(runtime ?? 0)).toBe(false);
    await expectNewRuntimeAsync(desktop, runtime);
    expect(await desktop.isVisibleAsync()).toBe(true);
    await acceptHandoffFailureAsync(desktop, (await readUpdateAsync(window)).reason ?? "");
  });
});

test("Restart to update stops TeamRun in every data directory of the installation, and when the handoff fails, TeamRun runs on with the update ready and the reason", async ({}, testInfo) => {
  test.skip(process.platform === "linux", "The development app on Linux fails before it offers the restart; the first workflow covers it.");
  test.skip(process.platform === "darwin", "The development app on macOS runs outside Applications, where a ready update only shows as available; the first workflow covers it.");
  test.setTimeout(180_000);
  await withReadyUpdateAsync(testInfo, async ({ launchAsync }) => {
    const other = await launchAsync();
    const otherRuntime = await other.readRuntimeProcessIdAsync();
    const otherDesktop = other.application.process().pid ?? 0;
    const desktop = await launchAsync();
    const runtime = await desktop.readRuntimeProcessIdAsync();
    const about = await openAboutAsync(desktop.window);

    await about.getByRole("button", { name: "Restart to update" }).click();

    await expect.poll(() => DesktopApplicationFixture.isAlive(otherDesktop), { timeout: 60_000 }).toBe(false);
    await expect.poll(() => DesktopApplicationFixture.isAlive(otherRuntime ?? 0), { timeout: 30_000 }).toBe(false);
    await expect.poll(async () => (await readUpdateAsync(desktop.window)).reason, { timeout: 90_000 }).not.toBeNull();
    const update = await readUpdateAsync(desktop.window);
    expect(update).toEqual(expect.objectContaining({ kind: "Ready", version: VERSION }));
    if (process.platform === "win32")
      expect(update.reason).toMatch(/^The update's installer /);
    await expect(about.locator(".tr-about-detail")).toHaveText(update.reason ?? "");
    expect(DesktopApplicationFixture.isAlive(runtime ?? 0)).toBe(false);
    await expectNewRuntimeAsync(desktop, runtime);
    await expect(about.getByRole("button", { name: "Restart to update" })).toBeVisible();
    expect(await desktop.isVisibleAsync()).toBe(true);
    await acceptHandoffFailureAsync(desktop, update.reason ?? "");
  });
});
