/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ApiVisibility from "../../api/api-visibility.ts";

class ApiVisibilityTests {
  public static register(): void {
    test("a public API leaves out protected members, and a public and protected API includes them", () => {
      assert.deepEqual([ApiVisibility.PUBLIC.includesProtected, ApiVisibility.PUBLIC_AND_PROTECTED.includesProtected], [false, true]);
    });
  }
}

ApiVisibilityTests.register();
