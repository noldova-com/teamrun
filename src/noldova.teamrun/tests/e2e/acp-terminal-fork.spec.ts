/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { expect } from "playwright/test";

import { type IStartedProcess, TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

const DOUBLE: string = path.join(import.meta.dirname, "fixtures", "acp-fork-double.ts");
const NAME: string = "Fork double";

const hasEnded = (started: IStartedProcess | null | undefined): boolean => started === null || started === undefined || !TeamRunApp.isAlive(started);

test("Stop ends a child that an added ACP agent's command left holding its output after the command's first process exited", async ({ app }) => {
  test.skip(process.platform !== "linux", "Linux, where the fixture reads processes from /proc and the leftovers are found by the command's process group");
  const pids = path.join(app.work, "fork.pid");
  const page = await app.startAsync();
  const providers = page.locator("nol-teamrun-providers-view");
  await expect(providers.getByRole("note", { name: "Welcome to TeamRun" })).toBeVisible({ timeout: 60_000 });

  await providers.getByRole("button", { name: "Add provider", exact: true }).click();
  await providers.getByRole("group", { name: "Provider type" }).locator("[data-kind='acp:agents']").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Local ACP command", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Name", exact: true }).fill(NAME);
  await dialog.getByRole("textbox", { name: "Command", exact: true }).fill(process.execPath);
  await dialog.getByRole("textbox", { name: "Arguments", exact: true }).fill(`${DOUBLE}\n${pids}`);
  await dialog.getByRole("button", { name: "Add command", exact: true }).click();
  await expect(dialog.getByRole("list", { name: "Local ACP commands" })).toContainText(NAME, { timeout: 60_000 });
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toBeHidden();
  const card = providers.getByRole("group", { name: "Provider type" }).getByRole("button").filter({ hasText: NAME });
  await expect(card).toHaveAttribute("aria-pressed", "true");
  const save = providers.locator(".nol-teamrun-add-save");
  await expect(save).toBeEnabled({ timeout: 60_000 });
  await save.click();
  await providers.getByRole("button", { name: "Continue", exact: true }).click({ timeout: 60_000 });
  const teammate = providers.getByRole("form", { name: "Your first teammate" });
  const answeredBy = teammate.locator("nol-select.nol-teamrun-provider").getByRole("button");
  await answeredBy.click();
  await page.getByRole("listbox", { name: "Answered by" }).getByRole("option").filter({ hasText: NAME }).click();
  await expect(answeredBy).toContainText(NAME);
  await teammate.getByRole("button", { name: "Start chatting", exact: true }).click();
  await expect(teammate).toBeHidden();

  await app.sendAsync("Start the server");
  await expect.poll(() => TeamRunApp.readPid(pids), TeamRunApp.pollOf(60_000)).not.toBeNull();
  const [child, root] = readFileSync(pids, "utf8").trim().split(" ").map(t => TeamRunApp.processOf(Number(t)));
  await expect.poll(() => hasEnded(root), TeamRunApp.pollOf(30_000)).toBe(true);
  expect(hasEnded(child), "the forked child runs after the command's first process exited").toBe(false);

  await page.getByRole("tab", { name: "Background tasks", exact: true }).click();
  const tasks = page.locator("nol-teamrun-background-tasks-view");
  await tasks.locator(".nol-tool-call-cancel").click({ timeout: 60_000 });
  await expect.poll(() => hasEnded(child), TeamRunApp.pollOf(30_000)).toBe(true);
  await expect(tasks.locator(".nol-tool-call-cancel")).toHaveCount(0, { timeout: 30_000 });
});
