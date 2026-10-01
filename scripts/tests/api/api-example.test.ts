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

class ApiExampleTests {
  public static register(): void {
    test("an example keeps its owner, number and code, and names its file and title from them", () => {
      const example = new ApiExample("Counter#next", 2, "next();\n");

      assert.deepEqual([example.owner, example.index, example.code], ["Counter#next", 2, "next();\n"]);
      assert.equal(example.fileName, "Counter-next-2.ts");
      assert.equal(example.title, "Counter#next example 2");
      assert.equal(new ApiExample("Shape.constructor", 1, "").fileName, "Shape-constructor-1.ts");
    });
  }
}

ApiExampleTests.register();
