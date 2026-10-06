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
import ChangeSelection from "../../workflows/change-selection.ts";

class ChangeSelectionTests {
  public static register(): void {
    test("selecting everything keeps its reason and narrows nothing", () => {
      const selection = ChangeSelection.everything("package.json is shared configuration.");

      assert.deepEqual([selection.isEverything, selection.reason, selection.tests, selection.uiWorkflows], [true, "package.json is shared configuration.", undefined, undefined]);
      assert.equal(selection.summary, "Selection: everything. package.json is shared configuration.");
    });

    test("a narrowed selection names its tests and its UI workflows, each once and sorted", () => {
      const tests = new SelectedTests(["@noldova/teamrun-shell-cli"], false, true);
      const every = ChangeSelection.narrowed(tests);
      const none = ChangeSelection.narrowed(new SelectedTests([], false, false), []);
      const specs = ChangeSelection.narrowed(tests, ["src/shell/desktop/tests/e2e/menus.spec.ts", "src/shell/desktop/tests/e2e/cli.spec.ts", "src/shell/desktop/tests/e2e/menus.spec.ts"]);

      assert.deepEqual([every.isEverything, every.tests, every.uiWorkflows], [false, tests, undefined]);
      assert.equal(every.summary, "Selection: every check other than the tests, the package tests of @noldova/teamrun-shell-cli and the script tests, and every UI workflow.");
      assert.equal(none.summary, "Selection: every check other than the tests, no tests, and no UI workflow.");
      assert.deepEqual(specs.uiWorkflows, ["src/shell/desktop/tests/e2e/cli.spec.ts", "src/shell/desktop/tests/e2e/menus.spec.ts"]);
      assert.equal(specs.summary, "Selection: every check other than the tests, the package tests of @noldova/teamrun-shell-cli and the script tests, "
        + "and the UI workflows src/shell/desktop/tests/e2e/cli.spec.ts, src/shell/desktop/tests/e2e/menus.spec.ts.");
    });
  }
}

ChangeSelectionTests.register();
