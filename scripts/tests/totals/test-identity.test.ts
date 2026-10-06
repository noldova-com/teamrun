/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import TestIdentity from "../../totals/test-identity.ts";

class TestIdentityTests {
  public static register(): void {
    test("a test is named by its file and then each name it is nested under, outermost first", () => {
      assert.equal(TestIdentity.of("scripts/tests/test.test.ts", ["Test", "a repeat", "stops"]), "scripts/tests/test.test.ts › Test › a repeat › stops");
      assert.equal(TestIdentity.of("a.spec.ts", []), "a.spec.ts");
    });
  }
}

TestIdentityTests.register();
