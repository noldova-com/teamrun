/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";

import DesktopLogFixture from "./fixtures/desktop-log.fixture.ts";

test.describe("the harness's reading of the desktop log's main-process failures", () => {
  let folder: string;
  let file: string;

  test.beforeEach(async () => {
    folder = await mkdtemp(path.join(os.tmpdir(), "teamrun-desktop-log-"));
    file = path.join(folder, "desktop.log");
  });

  test.afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  test("a log that cannot be read says so with its error code alone, never that it holds no failure", async () => {
    expect(await DesktopLogFixture.describeMainProcessFailuresAsync(file)).toBe("The desktop log could not be read (ENOENT).");
  });

  test("a log without a main-process failure says so, even when another entry's stack mentions one", async () => {
    await writeFile(file, [
      "2026-10-05T20:00:00.000Z The desktop started.",
      "2026-10-05T20:00:01.000Z A module failed: Error: The desktop's main process failed in a message.",
      "    at run (module.js:1:1)",
      ""
    ].join("\n"));

    expect(await DesktopLogFixture.describeMainProcessFailuresAsync(file)).toBe("The desktop log shows no main-process failure.");
  });

  test("each main-process failure is given whole with its stack, and only those entries", async () => {
    await writeFile(file, [
      "2026-10-05T20:00:00.000Z The desktop started.",
      "2026-10-05T20:00:01.000Z The desktop's main process failed with an uncaught exception: Error: First.",
      "    at first (main.js:1:1)",
      "2026-10-05T20:00:02.000Z The person chose Restart TeamRun.",
      "2026-10-05T20:00:03.000Z The desktop could not ask what to do after its main process failed, so it quits: Error: No box.",
      "    at box (main.js:2:2)",
      ""
    ].join("\n"));

    expect(await DesktopLogFixture.describeMainProcessFailuresAsync(file)).toBe([
      "The desktop log shows these main-process failures:",
      "2026-10-05T20:00:01.000Z The desktop's main process failed with an uncaught exception: Error: First.",
      "    at first (main.js:1:1)",
      "2026-10-05T20:00:03.000Z The desktop could not ask what to do after its main process failed, so it quits: Error: No box.",
      "    at box (main.js:2:2)"
    ].join("\n"));
  });
});
