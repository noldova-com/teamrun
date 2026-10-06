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

class FlakyTestTests {
  public static register(): void {
    test("a flaky test keeps its runner, file, name and failure", () => {
      const flaky = new FlakyTest("Script tests", "scripts/tests/a.test.ts", "group > test", "not ok 1 - test");

      assert.deepEqual([flaky.runner, flaky.file, flaky.name, flaky.failure], ["Script tests", "scripts/tests/a.test.ts", "group > test", "not ok 1 - test"]);
    });
  }
}

FlakyTestTests.register();
