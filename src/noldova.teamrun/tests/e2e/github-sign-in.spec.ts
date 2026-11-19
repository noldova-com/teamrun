/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { type Locator, type Page, expect } from "playwright/test";

import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

interface IEdges {
  readonly left: number;
  readonly right: number;
}

const DOUBLE: string = path.join(import.meta.dirname, "fixtures", "github-double.cjs");
const USER_CODE: string = "E2ED-0001";
const VERIFICATION_URI: string = "https://github.com/login/device";
const DEVICE_CODE_ANSWERED: string = "answered POST https://github.com/login/device/code";
const TOKEN_ANSWERED: string = "answered POST https://github.com/login/oauth/access_token";
const OTHER_HOST: string = "https://example.com/";
const OTHER_HOST_REFUSED: string = `refused GET ${OTHER_HOST}`;
const RUNTIME_LOADED: string = "loaded runtime";
const USER_ANSWERED: string = "answered GET https://api.github.com/user";
const LOGIN: string = "octo-e2e";
const GITHUB_PAGE: string = "GitHub";
const BROWSER_PAGE: string = "Browser";
const LINK_CLICK_ROW: string = "Open a link you click";
const IN_YOUR_BROWSER: string = "In your browser";
const OTHER_VERIFICATION_URI: string = "https://teamrun-e2e.invalid/login/device";
const OTHER_PAGE: string = "Appearance";
const PAGES: string = "Settings pages";
const TOLERANCE_REM: number = 0.05;

const edgesOf = (locator: Locator): Promise<IEdges> => locator.evaluate(t => {
  const box = t.getBoundingClientRect();
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return { left: box.left / rem, right: box.right / rem };
});

const expectAt = (actual: number, expected: number, what: string): void => {
  expect(Math.abs(actual - expected), `${what}: ${actual} rem against ${expected} rem`).toBeLessThan(TOLERANCE_REM);
};

const choosePageAsync = async (page: Page, title: string): Promise<void> => {
  const settings = page.locator("nol-settings");
  const select = settings.locator(".nol-settings-page-select").getByRole("button");
  const item = settings.locator(".nol-settings-pages").getByRole("treeitem", { name: title, exact: true, includeHidden: true });
  await expect.poll(async () => await select.isVisible() || await item.isVisible(), TeamRunApp.pollOf(30_000)).toBe(true);
  if (await select.isVisible()) {
    await select.click();
    await page.getByRole("listbox", { name: PAGES }).getByRole("option", { name: title, exact: true }).click();
  } else
    await item.click({ timeout: 30_000 });
  await expect(item).toHaveAttribute("aria-selected", "true");
};

const linesOf = (log: string): readonly string[] => existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(t => t !== "") : [];

test("Settings' GitHub page lines up with Settings' other pages, opens a device code from a double in the person's browser when they choose it, cancels it, then signs in and out, never reaching a host but loopback", async ({ app }) => {
  const log = path.join(app.work, "github.log");
  const page = await app.openChatAsync({ TEAMRUN_GITHUB_DOUBLE_CODE: USER_CODE, TEAMRUN_GITHUB_DOUBLE_LOG: log }, [DOUBLE]);
  await app.electronApp.evaluate(({ shell }) => {
    const opened: string[] = [];
    Reflect.set(globalThis, "openedLinks", opened);
    shell.openExternal = (url: string): Promise<void> => {
      opened.push(url);
      return Promise.resolve();
    };
  });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await choosePageAsync(page, BROWSER_PAGE);
  const linkClick = page.getByRole("radiogroup", { name: LINK_CLICK_ROW });
  await linkClick.getByRole("radio", { name: IN_YOUR_BROWSER, exact: true }).click();
  await expect(linkClick.getByRole("radio", { checked: true })).toHaveText(IN_YOUR_BROWSER);

  await choosePageAsync(page, OTHER_PAGE);
  const row = page.locator("nol-setting-row").first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  const [column, rowEdges, rowTitle] = await Promise.all([
    edgesOf(page.locator(".nol-settings-column")), edgesOf(row), edgesOf(row.locator(".nol-setting-row-title").first())
  ]);

  await choosePageAsync(page, GITHUB_PAGE);
  await expect(page.locator(".nol-settings-column > h2.nol-settings-group-title")).toHaveText(GITHUB_PAGE);
  const section = page.locator("nol-settings-page-host .nol-git-github-setting");
  const signIn = section.getByRole("button", { name: "Sign in to GitHub", exact: true });
  await expect(signIn).toBeVisible({ timeout: 30_000 });
  const [gitHubColumn, signedOut, accountTitle] = await Promise.all([
    edgesOf(page.locator(".nol-settings-column")), edgesOf(section), edgesOf(section.locator(".nol-git-github-setting-title"))
  ]);
  expectAt(gitHubColumn.left, column.left, "the column's start");
  expectAt(gitHubColumn.right, column.right, "the column's end");
  expectAt(signedOut.left, rowEdges.left, "the signed-out section's start against a setting row's");
  expectAt(signedOut.right, rowEdges.right, "the signed-out section's end against a setting row's");
  expectAt(accountTitle.left, rowTitle.left, "the Account title's start against a setting's title");

  await expect.poll(() => linesOf(log), TeamRunApp.pollOf(30_000)).toContain(RUNTIME_LOADED);
  const refusal = await app.electronApp.evaluate(async (_electron, url) => {
    try {
      await fetch(url);
      return "fetched";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }, OTHER_HOST);
  expect(refusal).toContain(OTHER_HOST_REFUSED.slice("refused ".length));
  await signIn.click();
  const code = section.locator(".nol-git-github-code");
  await expect(code).toHaveText(USER_CODE, { timeout: 30_000 });
  await expect(section.getByText(`Paste the code ${USER_CODE} on GitHub's page; it's copied.`)).toBeVisible();
  expect(await app.electronApp.evaluate(({ clipboard }) => clipboard.readText())).toBe(USER_CODE);
  await expect.poll(() => app.electronApp.evaluate(() => Reflect.get(globalThis, "openedLinks")), TeamRunApp.pollOf()).toEqual([VERIFICATION_URI]);
  const [waiting, codeEdges] = await Promise.all([edgesOf(section), edgesOf(code)]);
  expectAt(waiting.left, rowEdges.left, "the waiting section's start against a setting row's");
  expectAt(waiting.right, rowEdges.right, "the waiting section's end against a setting row's");
  expectAt(codeEdges.left, rowTitle.left, "the code's start against a setting's title");

  await section.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(signIn).toBeVisible({ timeout: 30_000 });
  await expect(code).toHaveCount(0);
  await expect(section.getByText(/^Sign in to see pull requests/)).toBeVisible();

  await signIn.click();
  await expect(code).toHaveText(USER_CODE, { timeout: 30_000 });
  writeFileSync(`${log}.approved`, "");
  await expect(section.getByText(LOGIN, { exact: true })).toBeVisible({ timeout: 30_000 });
  await section.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(signIn).toBeVisible({ timeout: 30_000 });
  await expect(section.getByText(LOGIN, { exact: true })).toHaveCount(0);

  const lines = linesOf(log);
  const answered = lines.filter(t => t.startsWith("answered "));
  expect(lines).toContain("loaded browser");
  expect(answered[0]).toBe(DEVICE_CODE_ANSWERED);
  expect(new Set(answered)).toEqual(new Set([DEVICE_CODE_ANSWERED, TOKEN_ANSWERED, USER_ANSWERED]));
  expect(lines.filter(t => t.startsWith("refused "))).toEqual([OTHER_HOST_REFUSED]);
  expect(app.unexpectedFailures).toEqual([]);
});

test("with the default Links setting, Settings' GitHub page opens a device code's page in the person's browser and not in the app's Browser", async ({ app }) => {
  const log = path.join(app.work, "github.log");
  const page = await app.openChatAsync({ TEAMRUN_GITHUB_DOUBLE_CODE: USER_CODE, TEAMRUN_GITHUB_DOUBLE_LOG: log, TEAMRUN_GITHUB_DOUBLE_VERIFICATION: OTHER_VERIFICATION_URI }, [DOUBLE]);
  await app.electronApp.evaluate(({ shell }) => {
    const opened: string[] = [];
    Reflect.set(globalThis, "openedLinks", opened);
    shell.openExternal = (url: string): Promise<void> => {
      opened.push(url);
      return Promise.resolve();
    };
  });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await choosePageAsync(page, GITHUB_PAGE);
  const signIn = page.locator("nol-settings-page-host .nol-git-github-setting").getByRole("button", { name: "Sign in to GitHub", exact: true });
  await expect(signIn).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => linesOf(log), TeamRunApp.pollOf(30_000)).toContain(RUNTIME_LOADED);

  await signIn.click();

  await expect.poll(() => app.electronApp.evaluate(() => Reflect.get(globalThis, "openedLinks")), TeamRunApp.pollOf()).toEqual([OTHER_VERIFICATION_URI]);
  await expect(page.getByRole("tab", { name: /teamrun-e2e[.]invalid/u })).toHaveCount(0);
  const lines = linesOf(log);
  expect(lines.filter(t => t.startsWith("answered "))[0]).toBe(DEVICE_CODE_ANSWERED);
  expect(lines.filter(t => t.startsWith("refused "))).toEqual([]);
  expect(app.unexpectedFailures).toEqual([]);
});
