/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ScriptTestCheck from "../../checks/script-test-check.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";

class ScriptTestCheckTests {
  public static register(): void {
    test("Node's test runner runs every script test with complete coverage required, and only exit code zero passes", async () => {
      const runner = new ProcessRunnerFixture([0, 1]);
      const check = new ScriptTestCheck("repository", runner);

      assert.equal(await check.runAsync(), true);
      assert.equal(await check.runAsync(), false);

      assert.deepEqual(runner.runs[0], [
        process.execPath,
        "repository",
        "--test",
        "--test-timeout=30000",
        "--experimental-test-coverage",
        "--test-coverage-include-all",
        "--test-coverage-include=scripts/**/*.ts",
        "--test-coverage-exclude=scripts/tests/**",
        "--test-coverage-exclude=scripts/**/interfaces/**",
        "--test-coverage-lines=100",
        "--test-coverage-branches=100",
        "--test-coverage-functions=100",
        "scripts/tests/**/*.test.ts"
      ]);
      assert.equal(check.title, "Script tests and coverage");
    });
  }
}

ScriptTestCheckTests.register();
