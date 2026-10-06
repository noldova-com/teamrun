/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import RepeatSelection from "../../workflows/repeat-selection.ts";

class RepeatSelectionTests {
  public static register(): void {
    test("each test file becomes the filter its runner selects it by, in path order", () => {
      const selection = new RepeatSelection([
        "src/shell/window/tests/app/bar.component.spec.ts",
        "scripts/tests/desktop/electron-binary.test.ts",
        "src/modules/notes/window/tests/app/list.spec.ts",
        "src/foundation/testing/tests/exceptions/assert-failed.exception.test.ts"
      ], []);

      assert.deepEqual(selection.testArguments, [
        "--filter", "scripts/tests/desktop/electron-binary.test.ts",
        "--filter", "exceptions/assert-failed.exception.test",
        "--filter", "modules/notes/window/tests/app/list.spec.ts",
        "--filter", "shell/window/tests/app/bar.component.spec.ts"
      ]);
      assert.equal(selection.isEmpty, false);
    });

    test("the summary lists the test files and the UI workflow files, each in path order", () => {
      const selection = new RepeatSelection(["scripts/tests/b.test.ts", "scripts/tests/a.test.ts"], ["src/shell/desktop/tests/e2e/quit.spec.ts", "src/shell/desktop/tests/e2e/menus.spec.ts"]);
      const workflowsOnly = new RepeatSelection([], ["src/shell/desktop/tests/e2e/quit.spec.ts"]);

      assert.equal(selection.summary, [
        "Repeated test files:",
        "- scripts/tests/a.test.ts",
        "- scripts/tests/b.test.ts",
        "Repeated UI workflow files:",
        "- src/shell/desktop/tests/e2e/menus.spec.ts",
        "- src/shell/desktop/tests/e2e/quit.spec.ts"
      ].join("\n"));
      assert.deepEqual(selection.workflows, ["src/shell/desktop/tests/e2e/menus.spec.ts", "src/shell/desktop/tests/e2e/quit.spec.ts"]);
      assert.equal(workflowsOnly.summary, "Repeated UI workflow files:\n- src/shell/desktop/tests/e2e/quit.spec.ts");
      assert.deepEqual([workflowsOnly.isEmpty, workflowsOnly.testArguments], [false, []]);
    });

    test("an empty selection says nothing is repeated", () => {
      const selection = new RepeatSelection([], []);

      assert.deepEqual([selection.isEmpty, selection.testArguments, selection.summary], [true, [], "No test or UI workflow file is affected by the change, so nothing is repeated."]);
    });
  }
}

RepeatSelectionTests.register();
