/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync } from "node:fs";
import path from "node:path";

import { type ElectronApplication, type Page, expect } from "playwright/test";

import { LinkedSite } from "./fixtures/linked-site.ts";
import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

declare global {
  interface Window {
    readonly desktop: { readTrayAvailable(): Promise<unknown> };
  }
}

const TITLES: readonly string[] = ["One", "Two", "Three"];
const PARTITION_PREFIX: string = "persist:browser.";
const OUTSIDE_PROJECTS_WORKSPACE: string = "teamrun-chats";

const viewWorkspaceAsync = (application: ElectronApplication, address: string, workspaces: readonly string[]): Promise<string | null> =>
  application.evaluate(({ webContents, session }, { url, keys, prefix }) => {
    const contents = webContents.getAllWebContents().find(t => t.getURL() === url);
    return contents === undefined ? null : keys.find(t => session.fromPartition(`${prefix}${t}`, { cache: false }).storagePath === contents.session.storagePath) ?? "another";
  }, { url: address, keys: workspaces, prefix: PARTITION_PREFIX });

const viewCountAsync = (application: ElectronApplication, workspace: string): Promise<number> =>
  application.evaluate(({ webContents, session }, partition) => {
    const storage = session.fromPartition(partition, { cache: false }).storagePath;
    return webContents.getAllWebContents().filter(t => t.session.storagePath === storage).length;
  }, `${PARTITION_PREFIX}${workspace}`);

const openThreeAsync = async (app: TeamRunApp, site: LinkedSite, page: Page): Promise<void> => {
  await app.nameLocalSitesAsync(site.origin);
  await site.openFirstAsync(page);
  for (const step of LinkedSite.STEPS.slice(0, 2)) {
    await site.pressAsync(app.electronApp, step);
    await site.expectShownAsync(app.electronApp, page, step.to, LinkedSite.openedNameOf(step));
  }
};

test("three pages open as tabs in two workspaces come back after a restart at their addresses, each in its workspace, the shown one first and the others as they first show",
  async ({ app }, testInfo) => {
    const site = await LinkedSite.startAsync();
    try {
      const page = await app.openChatAsync();
      await app.nameLocalSitesAsync(site.origin);
      await site.openFirstAsync(page);
      const [step] = LinkedSite.STEPS;
      if (step === undefined)
        throw new Error("The linked site has no steps.");
      await site.pressAsync(app.electronApp, step);
      await site.expectShownAsync(app.electronApp, page, step.to, LinkedSite.openedNameOf(step));
      const folder = path.join(app.work, "site");
      mkdirSync(folder);
      const opened = app.run(["teamrun", "open-folder", folder, "--json"]);
      const projectId = String(/"id":"([0-9a-f-]{36})"/.exec(opened)?.[1]);
      expect(projectId, opened).toMatch(/^[0-9a-f-]{36}$/u);
      app.run(["teamrun", "new-chat", projectId, "--title", "Site work", "--json"]);
      await page.getByRole("treeitem", { name: /Site work/ }).first().click({ timeout: 60_000 });
      await expect(page.getByRole("tabpanel", { name: "Site work", exact: true }).getByRole("combobox", { name: "Message", exact: true })).toBeEditable({ timeout: 60_000 });
      await site.openFirstAsync(page, "Three");
      await site.expectShownAsync(app.electronApp, page, "Three");
      const workspaces: readonly string[] = [OUTSIDE_PROJECTS_WORKSPACE, projectId];
      const before = await Promise.all(TITLES.map(t => viewWorkspaceAsync(app.electronApp, site.urlOf(t), workspaces)));

      expect(app.quit()).toContain("\"outcome\":\"Quit\"");
      expect(await app.waitForExitAsync()).toBe(0);
      const restarted = await app.startAsync();

      for (const title of TITLES)
        await expect(restarted.getByRole("tab", { name: title, exact: true }), `${title}'s tab came back`).toBeVisible({ timeout: 60_000 });
      await expect.poll(() => site.isLoadedAsync(app.electronApp, "Three"), { message: "the shown page, Three, loaded", ...TeamRunApp.pollOf(60_000) }).toBe(true);
      const counts: (readonly number[])[] = [];
      const countAsync = async (): Promise<void> => {
        counts.push([await viewCountAsync(app.electronApp, OUTSIDE_PROJECTS_WORKSPACE), await viewCountAsync(app.electronApp, projectId)]);
      };
      await countAsync();
      for (const title of ["One", "Two"]) {
        await site.expectShownAsync(app.electronApp, restarted, title);
        await countAsync();
      }
      await site.expectShownAsync(app.electronApp, restarted, "Three");
      expect(counts).toEqual([[0, 1], [1, 1], [2, 1]]);
      const after = await Promise.all(TITLES.map(t => viewWorkspaceAsync(app.electronApp, site.urlOf(t), workspaces)));
      expect([before, after]).toEqual([[OUTSIDE_PROJECTS_WORKSPACE, OUTSIDE_PROJECTS_WORKSPACE, projectId], [OUTSIDE_PROJECTS_WORKSPACE, OUTSIDE_PROJECTS_WORKSPACE, projectId]]);
      await testInfo.attach("restarted", { body: await restarted.screenshot(), contentType: "image/png" });
    }
    finally {
      await site.closeAsync();
    }
  });

test("three pages open as tabs still show their pages after the window closes to the tray and comes back", async ({ app }, testInfo) => {
  const page = await app.openChatAsync();
  test.skip(await page.evaluate(() => window.desktop.readTrayAvailable()) === false, "The app found no tray host, so closing the window quits the app.");
  const site = await LinkedSite.startAsync();
  try {
    await openThreeAsync(app, site, page);
    expect(await app.electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);

    await app.electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(t => t.close()));
    await expect.poll(() => app.electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), { message: "the window closed to the tray", ...TeamRunApp.pollOf(30_000) }).toBe(0);
    const shown = app.electronApp.waitForEvent("window", { timeout: 60_000 });
    await app.electronApp.evaluate(({ app: electron }) => electron.emit("second-instance"));
    const reopened = await shown;

    for (const title of TITLES)
      await site.expectShownAsync(app.electronApp, reopened, title);
    await testInfo.attach("reopened", { body: await reopened.screenshot(), contentType: "image/png" });
  }
  finally {
    await site.closeAsync();
  }
});
