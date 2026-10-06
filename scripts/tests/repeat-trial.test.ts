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
import path from "node:path";
import { test } from "node:test";

class RepeatTrialTests {
  private static readonly MARKER: string = path.join(process.cwd(), "_build", "repeat-trial.marker");

  public static register(): void {
    test("passes only in the first run of a job, because it leaves a marker behind", async () => {
      const isRepeated = existsSync(RepeatTrialTests.MARKER);
      await mkdir(path.dirname(RepeatTrialTests.MARKER), { recursive: true });
      await writeFile(RepeatTrialTests.MARKER, "");

      assert.equal(isRepeated, false, "an earlier run in this job left the marker");
    });
  }
}

RepeatTrialTests.register();
