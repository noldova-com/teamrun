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
      const full = new VerificationScope(true, true, "Files changed.");
      const withoutUi = new VerificationScope(true, false, "Only tooling changed.");
      const skipped = new VerificationScope(false, false, "Only documentation changed.");

      assert.deepEqual([full.runCode, full.runUi, full.reason], [true, true, "Files changed."]);
      assert.deepEqual([withoutUi.runCode, withoutUi.runUi], [true, false]);
      assert.equal(full.summary, "Full build and test verification selected. Files changed.");
      assert.equal(withoutUi.summary, "The builds and tests run; the UI workflows are not required. Only tooling changed.");
      assert.equal(skipped.summary, "Code builds and tests are not required; the document checks still run. Only documentation changed.");
    });

    test("the UI workflows never run without the builds and tests", () => {
      const scope = new VerificationScope(false, true, "Only documentation changed.");

      assert.equal(scope.runUi, false);
      assert.equal(scope.summary, "Code builds and tests are not required; the document checks still run. Only documentation changed.");
    });
  }
}

VerificationScopeTests.register();
