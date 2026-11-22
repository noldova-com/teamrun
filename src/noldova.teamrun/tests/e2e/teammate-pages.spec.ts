/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, type Locator, type Page } from "playwright/test";

import { CodexDouble } from "./fixtures/codex-double.ts";
import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

const pagesOf = (folder: string): readonly string[] => existsSync(folder)
  ? readdirSync(folder, { recursive: true, withFileTypes: true }).filter(t => t.isFile()).map(t => readFileSync(path.join(t.parentPath, t.name), "utf8"))
  : [];

const SECOND: string = "Sol";
const ACP_DOUBLE: string = path.join(import.meta.dirname, "fixtures", "acp-pages-double.ts");
const ACP_NAME: string = "Pages double";

const startChatAsync = async (app: TeamRunApp, page: Page): Promise<{ readonly chatId: string; readonly folder: string; readonly panel: Locator }> => {
  const folder = path.join(app.work, "site");
  mkdirSync(folder);
  writeFileSync(path.join(folder, "options.html"), "<h1>Draft</h1>");
  const opened = app.run(["teamrun", "open-folder", folder, "--json"]);
  const projectId = /"id":"([0-9a-f-]{36})"/.exec(opened)?.[1];
  expect(projectId, opened).toBeDefined();
  const created = app.run(["teamrun", "new-chat", String(projectId), "--title", "Onboarding", "--json"]);
  const chatId = /"id":"([0-9a-f-]{36})"/.exec(created)?.[1];
  expect(chatId, created).toBeDefined();
  await page.getByRole("treeitem", { name: /Onboarding/ }).first().click({ timeout: 60_000 });
  const panel = page.getByRole("tabpanel", { name: "Onboarding", exact: true });
  await expect(panel.getByRole("combobox", { name: "Message", exact: true })).toBeEditable({ timeout: 60_000 });
  return { chatId: String(chatId), folder, panel };
};

const addTeammateAsync = async (app: TeamRunApp, page: Page, panel: Locator, chatId: string, providerId: string): Promise<void> => {
  await app.sendAsync(`${CodexDouble.TEAMMATE_PREFIX}${SECOND} ${providerId} ${chatId}`);
  await page.locator("nol-permission-card").getByRole("button", { name: "Allow once", exact: true }).click({ timeout: 60_000 });
  await expect(panel.getByText(`${CodexDouble.TEAMMATE_PREFIX}${SECOND} added`, { exact: true })).toBeVisible({ timeout: 60_000 });
};

test("a teammate shows a page from its chat's folder and is refused a file outside it, a second teammate edits it as its next version, and the page goes with the chat",
  async ({ app }) => {
    const page = await app.openChatAsync();
    writeFileSync(path.join(app.work, "outside.html"), "<h1>Outside</h1>");
    const { chatId, folder, panel } = await startChatAsync(app, page);
    const pages = path.join(app.dataFolder, "modules", "teamrun", "pages");

    await app.submitAsync(`${CodexDouble.PAGE_PREFIX}options.html`);
    await expect(page.getByRole("tab", { name: CodexDouble.PAGE_TITLE, exact: true })).toBeVisible({ timeout: 60_000 });
    await TeamRunApp.showTabAsync(page, "Onboarding");
    await expect(panel.getByText(/^page: v1 made by \S/)).toBeVisible({ timeout: 60_000 });
    expect(pagesOf(path.join(pages, chatId))).toEqual(["<h1>Draft</h1>"]);

    await app.sendAsync(`${CodexDouble.PAGE_PREFIX}../outside.html`);
    await expect(panel.getByText("page: Refused: The file isn't in this chat's folder. Write the page in the chat's folder and show it from there.",
      { exact: true })).toBeVisible({ timeout: 60_000 });

    const providers = app.run(["teamrun", "list-providers", "--json"]);
    const providerId = /"id":"([^"]+)"/.exec(providers)?.[1];
    expect(providerId, providers).toBeDefined();
    await addTeammateAsync(app, page, panel, chatId, String(providerId));
    app.run(["teamrun", "send", chatId, "--teammate", SECOND, `${CodexDouble.EDIT_PAGE_PREFIX}Draft => Final`]);
    const edited = panel.getByText(new RegExp(`^${CodexDouble.EDIT_PAGE_PREFIX}v2 made by .+, edited by ${SECOND}$`));
    await expect(edited).toBeVisible({ timeout: 60_000 });
    const madeBy = /made by (.+), edited by/.exec(await edited.textContent() ?? "")?.[1] ?? "";
    const messages = app.run(["teamrun", "list-messages", chatId, "--json"]);
    expect([madeBy, madeBy.length > 0 && madeBy !== SECOND], messages).toEqual([/page: v1 made by ([^"]+)"/.exec(messages)?.[1], true]);
    expect(pagesOf(path.join(pages, chatId))).toEqual(["<h1>Final</h1>"]);
    expect(readFileSync(path.join(folder, "options.html"), "utf8")).toBe("<h1>Draft</h1>");

    app.run(["teamrun", "delete-chat", chatId]);
    await expect.poll(() => existsSync(path.join(pages, chatId)), TeamRunApp.pollOf(30_000)).toBe(false);
    expect(app.unexpectedFailures).toEqual([]);
  });

test("a teammate on an ACP provider lists, reads and edits a Codex teammate's page through TeamRun's tools, as its next version", async ({ app }) => {
  const page = await app.startAsync();
  const providers = page.locator("nol-teamrun-providers-view");
  await expect(providers.getByRole("note", { name: "Welcome to TeamRun" })).toBeVisible({ timeout: 60_000 });
  const found = providers.getByRole("button", { name: /^Add (?![Pp]rovider$)/ });
  await found.click({ timeout: 60_000 });
  await expect(found).toBeHidden({ timeout: 60_000 });
  await providers.getByRole("button", { name: "Add provider", exact: true }).click();
  await providers.getByRole("group", { name: "Provider type" }).locator("[data-kind='acp:agents']").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Local ACP command", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Name", exact: true }).fill(ACP_NAME);
  await dialog.getByRole("textbox", { name: "Command", exact: true }).fill(process.execPath);
  await dialog.getByRole("textbox", { name: "Arguments", exact: true }).fill(ACP_DOUBLE);
  await dialog.getByRole("button", { name: "Add command", exact: true }).click();
  await expect(dialog.getByRole("list", { name: "Local ACP commands" })).toContainText(ACP_NAME, { timeout: 60_000 });
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toBeHidden();
  const save = providers.locator(".nol-teamrun-add-save");
  await expect(save).toBeEnabled({ timeout: 60_000 });
  await save.click();
  await providers.getByRole("button", { name: "Continue", exact: true }).click({ timeout: 60_000 });
  const teammate = providers.getByRole("form", { name: "Your first teammate" });
  const answeredBy = teammate.locator("nol-select.nol-teamrun-provider").getByRole("button");
  await answeredBy.click();
  await page.getByRole("listbox", { name: "Answered by" }).getByRole("option").filter({ hasNotText: ACP_NAME }).first().click();
  await expect(answeredBy).not.toContainText(ACP_NAME);
  await teammate.getByRole("button", { name: "Start chatting", exact: true }).click();
  await expect(teammate).toBeHidden();
  const { chatId, panel } = await startChatAsync(app, page);
  const pages = path.join(app.dataFolder, "modules", "teamrun", "pages");

  await app.submitAsync(`${CodexDouble.PAGE_PREFIX}options.html`);
  const pageTab = TeamRunApp.tabOf(page, CodexDouble.PAGE_TITLE);
  await expect(pageTab).toBeVisible({ timeout: 60_000 });
  await TeamRunApp.showTabAsync(page, "Onboarding");
  await expect(panel.getByText(/^page: v1 made by \S/)).toBeVisible({ timeout: 60_000 });
  const listed = app.run(["teamrun", "list-providers", "--json"]);
  const acpId = /"id":"([^"]+)","kind":"local-pages-double"/.exec(listed)?.[1];
  expect(acpId, listed).toBeDefined();
  await addTeammateAsync(app, page, panel, chatId, String(acpId));
  app.run(["teamrun", "send", chatId, "--teammate", SECOND, `${CodexDouble.EDIT_PAGE_PREFIX}Draft => Final`]);

  const edited = panel.getByText(new RegExp(`^${CodexDouble.EDIT_PAGE_PREFIX}v2 made by .+, edited by ${SECOND}$`));
  await expect(edited).toBeVisible({ timeout: 60_000 });
  const card = panel.locator("nol-teamrun-history-message").filter({ hasText: new RegExp(`${CodexDouble.EDIT_PAGE_PREFIX}v2 made by .+, edited by ${SECOND}`) })
    .locator("nol-teamrun-page-card");
  await expect(card.locator(".meta-text")).toHaveText(new RegExp(`^v2 · Made by .+ · Edited by ${SECOND} · `), { timeout: 60_000 });
  expect(pagesOf(path.join(pages, chatId))).toEqual(["<h1>Final</h1>"]);
  const reply = panel.getByRole("article", { name: new RegExp(`^${SECOND}, `) });
  await reply.getByRole("button", { name: /^Worked for / }).click();
  for (const step of ["Listed the chat's pages · 1 page", `Read a page · ${CodexDouble.PAGE_TITLE}, v1`, "Edited a page · v1 to v2"])
    await expect(reply.getByText(step, { exact: true })).toBeVisible({ timeout: 60_000 });

  await expect(pageTab).toHaveAttribute("aria-selected", "false");
  await expect(card.getByRole("button")).toHaveCount(0);
  await TeamRunApp.showTabAsync(page, CodexDouble.PAGE_TITLE);
  await expect(pageTab).toHaveAttribute("aria-selected", "true", { timeout: 60_000 });
  const pageDocument = page.locator("nol-teamrun-page-document");
  await expect(pageDocument.locator(".nol-teamrun-page-authors")).toHaveText(new RegExp(`^v2 · Made by .+ · Edited by ${SECOND} · `), { timeout: 60_000 });
  const shownText = (): Promise<readonly string[]> => app.electronApp.evaluate(({ webContents }) => Promise.all(webContents.getAllWebContents()
    .filter(t => /^http:\/\/127\.0\.0\.1:\d+\/pages\//u.test(t.getURL()) && !t.isLoading())
    .map(async t => String(await t.executeJavaScript("document.body.innerText")))));
  await expect.poll(shownText, TeamRunApp.pollOf(60_000)).toEqual(["Final"]);
  expect(app.unexpectedFailures).toEqual([]);
});
