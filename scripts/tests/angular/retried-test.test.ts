/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import RetriedTest from "../../angular/retried-test.ts";

class RetriedTestTests {
  public static register(): void {
    test("a retried test keeps its spec file, name and first failure", () => {
      const retried = new RetriedTest("shell/a.spec.ts", "A retries", "Error: first");

      assert.deepEqual([retried.file, retried.name, retried.failure], ["shell/a.spec.ts", "A retries", "Error: first"]);
    });
  }
}

RetriedTestTests.register();
