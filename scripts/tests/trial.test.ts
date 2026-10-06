/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

class TrialTests {
  private static readonly MARKER: string = fileURLToPath(new URL("../../_build/trial/failed-once", import.meta.url));

  public static register(): void {
    test("trial: fails on its first run and passes on its rerun", async () => {
      const hasFailed = existsSync(TrialTests.MARKER);
      await mkdir(fileURLToPath(new URL("../../_build/trial/", import.meta.url)), { recursive: true });
      await writeFile(TrialTests.MARKER, "");

      assert.ok(hasFailed, "The first run fails on purpose.");
    });

    test("trial: fails on every run", () => {
      assert.fail("This test fails on purpose on every run.");
    });
  }
}

TrialTests.register();
