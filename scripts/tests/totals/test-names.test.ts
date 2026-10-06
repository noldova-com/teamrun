/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import TestNames from "../../totals/test-names.ts";

class TestNamesTests {
  public static register(): void {
    test("a test named like an earlier one by its file and nesting is a duplicate, listed once however often it repeats", () => {
      const names = new TestNames();

      names.add("a.test.ts", ["outer", "same"]);
      names.add("a.test.ts", ["outer", "same"]);
      names.add("a.test.ts", ["outer", "same"]);
      names.add("a.test.ts", ["outer", "other"]);
      names.add("b.test.ts", ["outer", "same"]);
      names.add("a.test.ts", ["same"]);

      assert.deepEqual(names.duplicates, [{ file: "a.test.ts", names: ["outer", "same"] }]);
    });

    test("tests with different names have no duplicates", () => {
      const names = new TestNames();

      names.add("a.test.ts", ["first"]);
      names.add("a.test.ts", ["second"]);

      assert.deepEqual(names.duplicates, []);
    });
  }
}

TestNamesTests.register();
