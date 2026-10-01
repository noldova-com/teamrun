/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import VerificationScope from "../../workflows/verification-scope.ts";

class VerificationScopeTests {
  public static register(): void {
    test("the summary states the selected scope and its reason", () => {
      const full = new VerificationScope(true, "Files changed.");
      const skipped = new VerificationScope(false, "Only documentation changed.");

      assert.equal(full.runCode, true);
      assert.equal(full.reason, "Files changed.");
      assert.equal(full.summary, "Full build and test verification selected. Files changed.");
      assert.equal(skipped.summary, "Code builds and tests are not required; the document checks still run. Only documentation changed.");
    });
  }
}

VerificationScopeTests.register();
