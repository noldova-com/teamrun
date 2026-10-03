/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir } from "node:fs/promises";
import os from "node:os";

import { expect, test } from "@playwright/test";

import DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";

test("a launch that fails keeps its trace, windows, pages and logs, and leaves nothing behind", async ({}, testInfo) => {
  test.setTimeout(90_000);
  const listRoots = async (): Promise<string[]> => (await readdir(os.tmpdir())).filter(t => t.startsWith("teamrun-ui-")).sort();
  const rootsBefore = await listRoots();

  const failure = await DesktopApplicationFixture.launchAsync(testInfo, {}, { "ownership.sqlite": "This is not a database." })
    .then(() => null, (error: unknown) => error);

  expect(failure).not.toBeNull();
  const attachments = new Map(testInfo.attachments.map(t => [t.name, t]));
  expect([...attachments.keys()]).toEqual(expect.arrayContaining(["trace.zip", "windows.json", "page-0.png", "page-0.html"]));
  expect(JSON.parse(String(attachments.get("windows.json")?.body))).toEqual([expect.objectContaining({ isVisible: true, isCrashed: false })]);
  expect(String(attachments.get("page-0.html")?.body)).toContain("tr-");
  expect([...attachments.keys()].some(t => /^start-.+\.log$/.test(t))).toBe(true);
  expect([...attachments.keys()].filter(t => t.endsWith(".unavailable.txt"))).toEqual([]);
  expect(await listRoots()).toEqual(rootsBefore);
});
