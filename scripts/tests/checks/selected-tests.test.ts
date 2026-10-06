/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import SelectedTests from "../../checks/selected-tests.ts";
import TestOptions from "../../test-options.ts";

class SelectedTestsTests {
  public static register(): void {
    test("a selection names each package once, in the order given, and describes its tests", () => {
      const selection = new SelectedTests(["@noldova/teamrun-foundation-core", "@noldova/teamrun-shell-protocol", "@noldova/teamrun-foundation-core"], true, true);

      assert.deepEqual(selection.packages, ["@noldova/teamrun-foundation-core", "@noldova/teamrun-shell-protocol"]);
      assert.equal(selection.description, "the package tests of @noldova/teamrun-foundation-core and @noldova/teamrun-shell-protocol, the Angular tests and the script tests");
      assert.equal(new SelectedTests(["@noldova/teamrun-foundation-core"], false, false).description, "the package tests of @noldova/teamrun-foundation-core");
      assert.equal(new SelectedTests([], true, false).description, "the Angular tests");
      assert.equal(new SelectedTests([], false, false).description, "no tests");
    });

    test("a selection's arguments to npm test select the same tests again", () => {
      const selections = [
        new SelectedTests(["@noldova/teamrun-foundation-core", "@noldova/teamrun-shell-protocol"], true, true),
        new SelectedTests([], false, true),
        new SelectedTests([], false, false)
      ];

      assert.deepEqual(selections[0]?.arguments, ["--package", "@noldova/teamrun-foundation-core", "--package", "@noldova/teamrun-shell-protocol", "--angular-tests", "--script-tests"]);
      assert.deepEqual(selections[2]?.arguments, ["--checks-only"]);
      for (const selection of selections) {
        const parsed = TestOptions.parse(selection.arguments).selection;

        assert.deepEqual([parsed?.packages, parsed?.runsAngularTests, parsed?.runsScriptTests], [selection.packages, selection.runsAngularTests, selection.runsScriptTests]);
      }
    });
  }
}

SelectedTestsTests.register();
