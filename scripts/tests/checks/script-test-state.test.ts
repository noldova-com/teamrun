/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import FlakyTest from "../../checks/flaky-test.ts";
import ScriptTestState from "../../checks/script-test-state.ts";

class ScriptTestStateTests {
  private static readonly ROOT: string = path.resolve("repository");
  private static readonly FILE: string = path.join(ScriptTestStateTests.ROOT, "scripts", "tests", "a.test.ts");

  public static register(): void {
    test("the tests that passed only on a later attempt are named with their suites, their file and the failure the first report gave them", () => {
      const state = JSON.stringify([
        { "scripts/tests/a.test.ts:8:3": { name: "always passes", children: [], passed_on_attempt: 0 } },
        {
          "scripts/tests/a.test.ts:8:3": { name: "always passes", children: [], passed_on_attempt: 0 },
          "scripts/tests/a.test.ts:5:5": { name: "fails once", children: [], passed_on_attempt: 1 },
          "scripts/tests/a.test.ts:4:3": { name: "inner", children: [ScriptTestStateTests.child(5, 5, "fails once")], passed_on_attempt: 1 },
          "scripts/tests/a.test.ts:3:1": { name: "outer", children: [ScriptTestStateTests.child(4, 3, "inner"), ScriptTestStateTests.child(8, 3, "always passes")], passed_on_attempt: 1 },
          "scripts/tests/a.test.ts:20:1": { name: "alone", children: [], passed_on_attempt: 1 }
        }
      ]);
      const report = [
        "TAP version 13",
        "# Subtest: outer",
        "    # Subtest: inner",
        "        # Subtest: fails once",
        "        not ok 1 - fails once",
        "          ---",
        "          duration_ms: 0.5",
        "          type: 'test'",
        `          location: '${ScriptTestStateTests.FILE}:5:5'`,
        "          error: 'first attempt fails'",
        "          ...",
        "        # Subtest: always passes",
        "        ok 2 - always passes",
        "          ---",
        "          duration_ms: 0.1",
        "          ...",
        "        1..2",
        "    not ok 1 - inner",
        "      ---",
        `      location: '${ScriptTestStateTests.FILE}:4:3'`,
        "      ...",
        "not ok 1 - outer",
        "  ---",
        `  location: '${ScriptTestStateTests.FILE}:3:1'`,
        "  ...",
        "# Subtest: alone",
        "not ok 2 - alone",
        "  ---",
        `  location: '${ScriptTestStateTests.FILE}:20:1'`,
        "  error: 'timed out'",
        "  ...",
        "1..2"
      ].join("\n");

      assert.deepEqual(ScriptTestState.readTests(ScriptTestStateTests.ROOT, state, report), [
        new FlakyTest("Script tests", "scripts/tests/a.test.ts", "outer > inner > fails once", "not ok 1 - fails once\n  ---\n  type: 'test'\n" +
          `  location: '${ScriptTestStateTests.FILE}:5:5'\n  error: 'first attempt fails'\n  ...`),
        new FlakyTest("Script tests", "scripts/tests/a.test.ts", "alone", `not ok 2 - alone\n  ---\n  location: '${ScriptTestStateTests.FILE}:20:1'\n  error: 'timed out'\n  ...`)
      ]);
      assert.equal(ScriptTestState.RUNNER, "Script tests");
    });

    test("a test the first report gives no failure for keeps an empty failure, and a block that never ends still counts", () => {
      const state = JSON.stringify([{ "scripts/tests/a.test.ts:5:5": { name: "fails once", children: [], passed_on_attempt: 1 }, "scripts/tests/a.test.ts:9:1": { name: "other", children: [], passed_on_attempt: 2 } }]);
      const report = `not ok 1 - fails once\n  ---\n  location: '${ScriptTestStateTests.FILE}:5:5'`;

      assert.deepEqual(ScriptTestState.readTests(ScriptTestStateTests.ROOT, state, report), [
        new FlakyTest("Script tests", "scripts/tests/a.test.ts", "fails once", `not ok 1 - fails once\n  ---\n  location: '${ScriptTestStateTests.FILE}:5:5'`),
        new FlakyTest("Script tests", "scripts/tests/a.test.ts", "other", "")
      ]);
      assert.deepEqual(ScriptTestState.readTests(ScriptTestStateTests.ROOT, state, "not ok 1 - fails once\n  ---\n  ...\nok 2 - next"), [
        new FlakyTest("Script tests", "scripts/tests/a.test.ts", "fails once", ""),
        new FlakyTest("Script tests", "scripts/tests/a.test.ts", "other", "")
      ]);
    });

    test("a state written on Windows, whose keys use its separator, names the file with forward slashes and finds its failure", () => {
      const key = `${path.win32.join("scripts", "tests", "a.test.ts")}:5:5`;
      const state = JSON.stringify([{ [key]: { name: "fails once", children: [], passed_on_attempt: 1 } }]);
      const report = `not ok 1 - fails once\n  ---\n  location: '${ScriptTestStateTests.FILE}:5:5'\n  ...`;

      assert.deepEqual(ScriptTestState.readTests(ScriptTestStateTests.ROOT, state, report), [
        new FlakyTest("Script tests", "scripts/tests/a.test.ts", "fails once", `not ok 1 - fails once\n  ---\n  location: '${ScriptTestStateTests.FILE}:5:5'\n  ...`)
      ]);
    });

    test("a state that is not JSON, not a list of attempts or has entries that are not tests names no test", () => {
      const entries = { "a:1:1": null, "b:1:1": { name: "no children", passed_on_attempt: 1 }, "c:1:1": { name: "unknown attempt", children: [] }, "d:1:1": { children: [7], passed_on_attempt: 1 } };

      for (const state of ["{", "{}", "[]", "[null]", "[1]"])
        assert.deepEqual(ScriptTestState.readTests(ScriptTestStateTests.ROOT, state, ""), []);
      assert.deepEqual(ScriptTestState.readTests(ScriptTestStateTests.ROOT, JSON.stringify([entries]), ""), []);
    });
  }

  private static child(line: number, column: number, name: string): Record<string, unknown> {
    return { file: ScriptTestStateTests.FILE, line, column, name };
  }
}

ScriptTestStateTests.register();
