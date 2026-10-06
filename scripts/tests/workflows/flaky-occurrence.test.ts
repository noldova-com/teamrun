/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import FlakyTest from "../../checks/flaky-test.ts";
import FlakyOccurrence from "../../workflows/flaky-occurrence.ts";

class FlakyOccurrenceTests {
  public static register(): void {
    test("an occurrence keeps its flaky test and a copy of the jobs it was flaky in", () => {
      const flaky = new FlakyTest("Script tests", "a.test.ts", "a", "failed");
      const jobs = ["ubuntu-24.04-x64"];
      const occurrence = new FlakyOccurrence(flaky, jobs);
      jobs.push("windows-2025-x64");

      assert.deepEqual([occurrence.test, occurrence.jobs], [flaky, ["ubuntu-24.04-x64"]]);
    });
  }
}

FlakyOccurrenceTests.register();
