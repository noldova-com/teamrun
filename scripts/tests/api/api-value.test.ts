/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ApiValue from "../../api/api-value.ts";
import ApiException from "../../api/api.exception.ts";

class ApiValueTests {
  public static register(): void {
    test("a required value is returned, and a missing one is refused with what was missing", () => {
      assert.equal(ApiValue.require(0, "number"), 0);
      assert.equal(ApiValue.require(null, "node"), null);
      assert.throws(() => ApiValue.require(undefined, "type"), new ApiException("The TypeScript API returned no type."));
    });

    test("modifier flags are read from a node that has them and are none otherwise", () => {
      assert.equal(ApiValue.readModifierFlags({ modifierFlags: 6 }), 6);
      assert.equal(ApiValue.readModifierFlags({ modifierFlags: "6" }), 0);
      assert.equal(ApiValue.readModifierFlags({}), 0);
    });
  }
}

ApiValueTests.register();
