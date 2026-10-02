/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ApiExample from "../../api/api-example.ts";
import ApiExamples from "../../api/api-examples.ts";

class ApiExamplesTests {
  public static register(): void {
    test("the set keeps copies of its examples and of the callables without one", () => {
      const examples = [new ApiExample("read", 1, "read();\n")];
      const undocumented = ["write"];
      const set = new ApiExamples(examples, undocumented);
      examples.length = 0;
      undocumented.length = 0;

      assert.deepEqual(set.examples.map(t => t.title), ["read example 1"]);
      assert.deepEqual(set.undocumented, ["write"]);
    });
  }
}

ApiExamplesTests.register();
