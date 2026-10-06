/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ChangeSelection from "../../workflows/change-selection.ts";
import VerificationScope from "../../workflows/verification-scope.ts";

class VerificationScopeTests {
  private static readonly SELECTION: ChangeSelection = ChangeSelection.everything("Files changed.");

  public static register(): void {
    test("the summary states the selected scope and its reason", () => {
      const full = new VerificationScope(true, true, "Files changed.", VerificationScopeTests.SELECTION);
      const withoutUi = new VerificationScope(true, false, "Only tooling changed.", VerificationScopeTests.SELECTION);
      const skipped = new VerificationScope(false, false, "Only documentation changed.", VerificationScopeTests.SELECTION);

      assert.deepEqual([full.runCode, full.runUi, full.reason, full.selection], [true, true, "Files changed.", VerificationScopeTests.SELECTION]);
      assert.deepEqual([withoutUi.runCode, withoutUi.runUi], [true, false]);
      assert.equal(full.summary, "Full build and test verification selected. Files changed.");
      assert.equal(withoutUi.summary, "The builds and tests run; the UI workflows are not required. Only tooling changed.");
      assert.equal(skipped.summary, "Code builds and tests are not required; the document checks still run. Only documentation changed.");
    });

    test("the UI workflows never run without the builds and tests", () => {
      const scope = new VerificationScope(false, true, "Only documentation changed.", VerificationScopeTests.SELECTION);

      assert.equal(scope.runUi, false);
      assert.equal(scope.summary, "Code builds and tests are not required; the document checks still run. Only documentation changed.");
    });
  }
}

VerificationScopeTests.register();
