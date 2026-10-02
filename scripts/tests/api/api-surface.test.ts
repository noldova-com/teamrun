/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ApiSurface from "../../api/api-surface.ts";

class ApiSurfaceTests {
  public static register(): void {
    test("comparing names what is missing, extra or different, in order", () => {
      const implemented = new ApiSurface(new Map([["b", "function"], ["a", "class"], ["c", "type = string"]]));
      const declared = new ApiSurface(new Map([["a", "class"], ["c", "type = number"], ["d", "variable : number"]]));

      assert.equal(implemented.size, 3);
      assert.deepEqual(implemented.compare(declared), [
        "b: missing from the declarations; the implementation has function",
        "c: the implementation has type = string; the declarations have type = number",
        "d: declared but not implemented; the declarations have variable : number"
      ]);
      assert.deepEqual(implemented.compare(implemented), []);
    });
  }
}

ApiSurfaceTests.register();
