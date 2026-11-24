/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect } from "playwright/test";

import { GitRepository } from "./fixtures/git-repository.ts";
import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

const MESSAGE: string = "Say what the site is";

test("the person commits a staged file in the shown chat's repository through the Git view, leaving the other change", async ({ app }) => {
  const page = await app.openChatAsync();
  const repository = GitRepository.create(app.work);
  const git = repository.git.bind(repository);
  repository.write("README.md", "# Site\n\nA small site.\n");
  repository.write("notes.txt", "Notes\n");
  const opened = app.run(["teamrun", "open-folder", repository.folder, "--json"]);
  const projectId = /"id":"([0-9a-f-]{36})"/.exec(opened)?.[1];
  expect(projectId, opened).toBeDefined();
  app.run(["teamrun", "new-chat", String(projectId), "--title", "Site work", "--json"]);

  await page.getByRole("treeitem", { name: /Site work/ }).first().click({ timeout: 60_000 });
  await TeamRunApp.showTabAsync(page, "Git");
  await page.getByRole("button", { name: "Stage README.md", exact: true }).click({ timeout: 60_000 });
  await page.getByRole("textbox", { name: "Commit message", exact: true }).fill(MESSAGE);
  await page.getByRole("button", { name: "Commit 1 file", exact: true }).click({ timeout: 60_000 });

  await expect.poll(() => git("log", "--format=%s"), TeamRunApp.pollOf(60_000)).toBe(`${MESSAGE}\nStart the site`);
  expect([git("log", "-1", "--format=%an <%ae>|%cn <%ce>"), git("show", "--name-only", "--format=", "HEAD"), git("status", "--porcelain")])
    .toEqual([`${GitRepository.AUTHOR}|${GitRepository.AUTHOR}`, "README.md", "?? notes.txt"]);
  await expect(page.locator("nol-git-file-group .path")).toHaveText(["notes.txt"], { timeout: 60_000 });
  await expect(page.getByRole("button", { name: /^Commit \d/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Commit", exact: true })).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "Commit message", exact: true })).toHaveValue("");
  expect(app.unexpectedFailures).toEqual([]);
});
