/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, type Locator } from "playwright/test";

import { CodexDouble } from "./fixtures/codex-double.ts";
import { GitRepository } from "./fixtures/git-repository.ts";
import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

const MESSAGE: string = "Say what the site is";
const HEADING: string = "Commit 1 file to main";
const TOLERANCE_REM: number = 0.05;

interface IBox {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

const boxOf = (locator: Locator): Promise<IBox> => locator.evaluate(t => {
  const box = t.getBoundingClientRect();
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return { left: box.left / rem, right: box.right / rem, top: box.top / rem, bottom: box.bottom / rem };
});

const LABELS: readonly string[] = ["Message:", "Files:", "Author:", "Hooks that will run:"];

const labelStartsOf = (locator: Locator): Promise<{ top: number; left: number }[]> => locator.evaluate((t, labels) => {
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const walker = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode())
    if (node instanceof Text)
      nodes.push(node);
  const shown = nodes.map(u => u.data).join("");
  return labels.map(label => {
    let offset = shown.indexOf(label);
    for (const node of offset < 0 ? [] : nodes) {
      if (offset < node.data.length) {
        const range = document.createRange();
        range.setStart(node, offset);
        range.setEnd(node, offset + 1);
        const box = range.getBoundingClientRect();
        return { top: box.top / rem, left: box.left / rem };
      }
      offset -= node.data.length;
    }
    return { top: Number.NaN, left: Number.NaN };
  });
}, LABELS);

test("a teammate's commit asks with Git's own card, its details labelled one per line and its Always allow in Git's words, and commits only after Allow once", async ({ app }, testInfo) => {
  const page = await app.openChatAsync();
  const repository = GitRepository.create(app.work);
  repository.write("README.md", "# Site\n\nA small site.\n");
  repository.git("add", "README.md");
  const opened = app.run(["teamrun", "open-folder", repository.folder, "--json"]);
  const projectId = /"id":"([0-9a-f-]{36})"/.exec(opened)?.[1];
  expect(projectId, opened).toBeDefined();
  app.run(["teamrun", "new-chat", String(projectId), "--title", "Site work", "--json"]);
  await page.getByRole("treeitem", { name: /Site work/ }).first().click({ timeout: 60_000 });
  await expect(page.getByRole("tabpanel", { name: "Site work", exact: true }).getByRole("combobox", { name: "Message", exact: true })).toBeEditable({ timeout: 60_000 });

  await app.submitAsync(`${CodexDouble.COMMIT_PREFIX}${MESSAGE}`);

  const card = page.locator("nol-permission-card").filter({ hasText: HEADING });
  await expect(card.locator(".nol-permission-card-heading")).toHaveText(HEADING, { timeout: 60_000 });
  await expect(card.locator(".nol-permission-card-risk")).toHaveText(/Medium risk/);
  await expect(card.locator(".nol-permission-card-option")).toHaveText(["Allow once", "Always allow in this repository", "Deny"]);
  await expect(card.getByRole("button", { name: /^Show all/ })).toHaveCount(0);
  await expect(card.locator(".nol-permission-card-code")).toHaveText(
    [`Message: ${MESSAGE}`, "Files: M README.md", `Author: ${GitRepository.AUTHOR} (from your Git settings)`, "Hooks that will run: None"].join("\n"));
  const starts = await labelStartsOf(card.locator(".nol-permission-card-code"));
  for (const [index, start] of starts.slice(1).entries()) {
    expect(start.top > (starts[index]?.top ?? Number.NaN), `${LABELS[index + 1]} starts below the detail before it`).toBe(true);
    expect(Math.abs(start.left - (starts[0]?.left ?? Number.NaN)), `${LABELS[index + 1]} starts a line at the details' edge`).toBeLessThan(TOLERANCE_REM);
  }
  const panel = await boxOf(page.getByRole("tabpanel", { name: "Site work", exact: true }));
  const shown = await boxOf(card);
  expect([shown.left >= panel.left, shown.right <= panel.right, shown.top >= panel.top, shown.bottom <= panel.bottom], "the card inside the chat's panel")
    .toEqual([true, true, true, true]);
  const options = await Promise.all((await card.locator(".nol-permission-card-option").all()).map(t => boxOf(t)));
  expect(options).toHaveLength(3);
  for (const [index, option] of options.slice(1).entries()) {
    const before = options[index];
    expect(Math.abs(option.top - (before?.top ?? Number.NaN)), "the options on one row").toBeLessThan(TOLERANCE_REM);
    expect(option.left >= (before?.right ?? Number.NaN), "the options in order").toBe(true);
  }
  await testInfo.attach("commit-card", { body: await card.screenshot(), contentType: "image/png" });
  expect(repository.git("log", "--format=%s")).toBe("Start the site");

  await card.getByRole("button", { name: "Allow once", exact: true }).click();

  await expect.poll(() => repository.git("log", "--format=%s"), TeamRunApp.pollOf(60_000)).toBe(`${MESSAGE}\nStart the site`);
  expect([repository.git("show", "--name-only", "--format=", "HEAD"), repository.git("status", "--porcelain")]).toEqual(["README.md", ""]);
  await expect(card).toHaveCount(0, { timeout: 60_000 });
  expect(app.unexpectedFailures).toEqual([]);
});
