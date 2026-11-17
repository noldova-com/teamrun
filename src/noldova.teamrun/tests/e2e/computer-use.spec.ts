/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync } from "node:fs";

import { type Locator, type Page, expect } from "playwright/test";

import { CodexDouble } from "./fixtures/codex-double.ts";
import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

const SETTING: string = "computer-use.enabled";
const SETTING_TEXT: RegExp = /^Lets agents see the screen and use the pointer and keyboard/;
const COMPUTER_TOOL_PREFIX: string = "computer_";
const SEARCH_DIAGNOSIS_AFTER: number = 5_000;

test.use({ isAppTraced: true });

const toolListsOf = (app: TeamRunApp): string[][] => existsSync(app.codexLog)
  ? readFileSync(app.codexLog, "utf8").split("\n").map(t => t.slice(t.indexOf(" ") + 1)).filter(t => t.startsWith(CodexDouble.TOOLS_PREFIX))
    .map(t => t.slice(CodexDouble.TOOLS_PREFIX.length).split(" ").filter(u => u !== ""))
  : [];

const listToolsAsync = async (app: TeamRunApp): Promise<readonly string[]> => {
  const before = toolListsOf(app).length;
  await app.sendAsync(CodexDouble.TOOLS_PROMPT);
  await expect.poll(() => toolListsOf(app).length, TeamRunApp.pollOf(60_000)).toBe(before + 1);
  const names = toolListsOf(app)[before] ?? [];
  await expect(app.page.getByText(`${CodexDouble.TOOLS_PREFIX}${names.join(" ")}`).last()).toBeVisible({ timeout: 30_000 });
  return names;
};

const expectNoComputerTools = (names: readonly string[]): void => {
  expect(names).toContain("terminal_run");
  expect(names.filter(t => t.startsWith(COMPUTER_TOOL_PREFIX))).toEqual([]);
};

const isLateAsync = async (search: Locator): Promise<boolean> => {
  try {
    await search.waitFor({ timeout: SEARCH_DIAGNOSIS_AFTER });
    return false;
  }
  catch (error) {
    if (error instanceof Error && error.name === "TimeoutError")
      return true;
    throw error;
  }
};

const searchStateOf = (page: Page): Promise<unknown> => page.evaluate(() => {
  const box = document.querySelector<HTMLInputElement>("input.nol-settings-search-field");
  const hider = box?.closest("[aria-hidden='true'], [inert], [hidden]") ?? null;
  return {
    isInDom: box !== null,
    isVisible: box?.checkVisibility() ?? false,
    hiddenBy: hider?.outerHTML.slice(0, 200) ?? null,
    hasSettings: document.querySelector("nol-settings") !== null,
    tabContents: [...document.querySelectorAll("nol-tab-content")].map(t => ({
      tab: t.getAttribute("data-tab-content"), children: [...t.children].map(u => u.localName), isVisible: t.checkVisibility()
    })),
    focused: document.activeElement?.outerHTML.slice(0, 200) ?? null
  };
});

const searchSettingAsync = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const search = page.getByRole("searchbox", { name: "Search settings", exact: true });
  if (await isLateAsync(search))
    console.log(`Search settings is missing ${SEARCH_DIAGNOSIS_AFTER} ms after the click: ${JSON.stringify(await searchStateOf(page))}`);
  await search.fill(SETTING);
};

const settingOf = async (page: Page): Promise<Locator> => {
  await searchSettingAsync(page);
  await expect(page.getByText("Computer use (preview)", { exact: true })).toBeVisible({ timeout: 30_000 });
  return page.getByRole("checkbox", { name: SETTING_TEXT });
};

const chatStateOf = (page: Page): Promise<unknown> => page.evaluate(() => {
  const row = document.querySelector(".nol-teamrun-conversation-row");
  const box = row?.getBoundingClientRect() ?? null;
  const top = box === null ? null : document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
  return {
    rows: document.querySelectorAll(".nol-teamrun-conversation-row").length,
    row: row?.outerHTML.slice(0, 300) ?? null,
    box: box === null ? null : { x: box.x, y: box.y, width: box.width, height: box.height },
    isRowOnTop: top !== null && row !== null && row.contains(top),
    top: top?.outerHTML.slice(0, 300) ?? null,
    tabContents: [...document.querySelectorAll("nol-tab-content")].map(t => ({
      tab: t.getAttribute("data-tab-content"), children: [...t.children].map(u => u.localName), isVisible: t.checkVisibility()
    })),
    focused: document.activeElement?.outerHTML.slice(0, 200) ?? null
  };
});

const openChatAsync = async (page: Page): Promise<void> => {
  await page.locator(".nol-teamrun-conversation-row").first().click();
  const composer = page.getByRole("combobox", { name: "Message", exact: true });
  try {
    await composer.waitFor({ timeout: 30_000 });
  }
  catch (error) {
    if (error instanceof Error && error.name === "TimeoutError")
      console.log(`The chat didn't open 30 s after the click, with ${await composer.count()} composers: ${JSON.stringify(await chatStateOf(page))}`);
    throw error;
  }
  await expect(composer).toBeVisible();
};

const failuresOf = (page: Page): Locator => page.getByRole("button", { name: /^\d+ modules? didn't start$/ });

const HAS_BACKEND: boolean = process.platform === "win32" || process.platform === "darwin";

const expectComputerToolsAsync = async (app: TeamRunApp): Promise<void> => {
  await expect.poll(async () => (await listToolsAsync(app)).filter(t => t.startsWith(COMPUTER_TOOL_PREFIX)).length, TeamRunApp.pollOf(60_000)).toBeGreaterThan(0);
};

test("computer use starts off and offers a teammate no computer tools, and turned on where it has a backend offers them, then and after a restart",
  async ({ app }, testInfo) => {
    test.skip(!HAS_BACKEND, "Computer use has a backend on Windows and macOS only");
    const page = await app.openChatAsync();
    expectNoComputerTools(await listToolsAsync(app));

    const setting = await settingOf(page);
    await expect(setting).not.toBeChecked();
    await setting.check();
    await expect(setting).toBeChecked();
    await openChatAsync(page);
    await expectComputerToolsAsync(app);

    expect(app.quit()).toContain("\"outcome\":\"Quit\"");
    expect(await app.waitForExitAsync()).toBe(0);
    const restarted = await app.startAsync();

    await expect(await settingOf(restarted)).toBeChecked();
    await openChatAsync(restarted);
    await expectComputerToolsAsync(app);
    await expect(failuresOf(restarted)).toHaveCount(0);
    await app.snapshotAsync(testInfo, "after-restart");
    expect(app.unexpectedFailures).toEqual([]);
  });

test("computer use doesn't run where it has no backend, so it offers a teammate no computer tools and Settings no switch for it, then and after a restart",
  async ({ app }) => {
    test.skip(HAS_BACKEND, "Computer use has a backend on Windows and macOS");
    const expectNoSettingAsync = async (page: Page): Promise<void> => {
      await searchSettingAsync(page);
      await expect(page.getByText("No settings match your search.", { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Computer use (preview)", { exact: true })).toHaveCount(0);
    };
    const page = await app.openChatAsync();
    expectNoComputerTools(await listToolsAsync(app));
    await expectNoSettingAsync(page);

    expect(app.quit()).toContain("\"outcome\":\"Quit\"");
    expect(await app.waitForExitAsync()).toBe(0);
    const restarted = await app.startAsync();

    await expectNoSettingAsync(restarted);
    await openChatAsync(restarted);
    expectNoComputerTools(await listToolsAsync(app));
    await expect(failuresOf(restarted)).toHaveCount(0);
    expect(app.unexpectedFailures).toEqual([]);
  });
