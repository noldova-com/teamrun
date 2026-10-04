/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";

import DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";

const listRoots = async (): Promise<string[]> => (await readdir(os.tmpdir())).filter(t => t.startsWith("teamrun-ui-")).sort();

test("a launch that fails says what the window, the data directory's lock, the processes and the processors showed, keeps its trace, windows, pages and logs, and leaves nothing behind", async ({}, testInfo) => {
  test.setTimeout(90_000);
  const rootsBefore = await listRoots();

  const failure = await DesktopApplicationFixture.launchAsync(testInfo, {}, { "ownership.sqlite": "This is not a database." })
    .then(() => null, (error: unknown) => error);

  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).toMatch(new RegExp([
    "^TeamRun's runtime did not start: the window reports that TeamRun could not start \\(.*file is not a database\\)\\. ",
    "The data directory's lock was never held\\. Processes naming the data directory: .+\\. ",
    "Processor load: \\d+ processors, busy each second: (?:not sampled|[\\d, ]+ %)\\.$"
  ].join(""), "s"));
  const attachments = new Map(testInfo.attachments.map(t => [t.name, t]));
  expect([...attachments.keys()]).toEqual(expect.arrayContaining(["trace.zip", "windows.json", "page-0.png", "page-0.html"]));
  expect(JSON.parse(String(attachments.get("windows.json")?.body))).toEqual([expect.objectContaining({ isVisible: true, isCrashed: false })]);
  expect(String(attachments.get("page-0.html")?.body)).toContain("tr-");
  expect([...attachments.keys()].some(t => /^start-.+\.log$/.test(t))).toBe(true);
  expect([...attachments.keys()].filter(t => t.endsWith(".unavailable.txt"))).toEqual([]);
  expect(attachments.has("cleanup-failure.txt")).toBe(false);
  expect(await listRoots()).toEqual(rootsBefore);
});

test("a launch that fails on an unreadable discovery file, whose cleanup then fails on it too, reports the launch's failure with the cleanup's kept beside it", async ({}, testInfo) => {
  test.setTimeout(90_000);
  const rootsBefore = await listRoots();

  const failure = await DesktopApplicationFixture.launchAsync(testInfo, {}, { "discovery/runtime.json": "This is not a discovery file." })
    .then(() => null, (error: unknown) => error);
  const kept = (await listRoots()).filter(t => !rootsBefore.includes(t));
  await Promise.all(kept.map(t => rm(path.join(os.tmpdir(), t), { recursive: true, force: true })));

  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).toMatch(/runtime\.json is not valid: /);
  expect((failure as Error).stack).toContain("waitForRuntimeAsync");
  expect((failure as Error).stack).not.toContain("disposeAsync");
  const cleanup = testInfo.attachments.filter(t => t.name === "cleanup-failure.txt");
  expect(cleanup).toHaveLength(1);
  expect(String(cleanup[0]?.body)).toMatch(/runtime\.json is not valid: .*disposeAsync/s);
  expect(kept).toHaveLength(1);
});
