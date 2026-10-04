/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import ScriptTestCheck from "../../checks/script-test-check.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class TapRunnerFixture extends ProcessRunnerFixture {
  private readonly report: string | null;

  public constructor(exitCodes: readonly (number | null)[], report: string | null) {
    super(exitCodes);

    this.report = report;
  }

  public override async runAsync(command: string, commandArguments: readonly string[], directory: string, environment?: NodeJS.ProcessEnv): Promise<number | null> {
    const destination = commandArguments.find(t => t.startsWith("--test-reporter-destination=") && !t.endsWith("=stdout"));
    if (destination !== undefined && this.report !== null)
      await writeFile(destination.slice("--test-reporter-destination=".length), this.report);
    return super.runAsync(command, commandArguments, directory, environment);
  }
}

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

    test("filters that are part of file paths select those files, which run without the coverage gate, and other filters are left to the other runners", async t => {
      const repository = await ScriptTestCheckTests.createRepositoryAsync(t);
      const runner = new ProcessRunnerFixture([0, 1]);
      const check = new ScriptTestCheck(repository.directory, runner);

      const passing = await check.runSelectedAsync(["alpha", "tests/deep", "a spec file's name"]);
      const failing = await check.runSelectedAsync(["beta"]);

      assert.deepEqual([passing.isPassing, passing.unit, passing.discovered, passing.selected, passing.unselected], [true, "script test files", 3, 2, 1]);
      assert.deepEqual([failing.isPassing, failing.discovered, failing.selected], [false, 3, 1]);
      assert.deepEqual(runner.runs, [
        [process.execPath, repository.directory, "--test", "--test-timeout=30000", "scripts/tests/alpha.test.ts", "scripts/tests/deep/gamma.test.ts"],
        [process.execPath, repository.directory, "--test", "--test-timeout=30000", "scripts/tests/beta.test.ts"]
      ]);
    });

    test("filters that are part of no file path select tests by name in every file and count the tests that matched", async t => {
      const repository = await ScriptTestCheckTests.createRepositoryAsync(t);
      const runner = new TapRunnerFixture([0, 1, 0], "TAP version 13\nok 1 - first\nnot ok 2 - second\nok 3 - scripts/tests/alpha.test.ts\n");
      const check = new ScriptTestCheck(repository.directory, runner);

      const passing = await check.runSelectedAsync(["a.b (c)", "second"]);
      const failing = await check.runSelectedAsync(["first"]);

      assert.deepEqual([passing.isPassing, passing.discovered, passing.selected], [true, 3, 3]);
      assert.deepEqual([failing.isPassing, failing.discovered, failing.selected], [false, 3, 3]);
      assert.deepEqual(runner.runs[0], [
        process.execPath, repository.directory, "--test", "--test-timeout=30000", `--test-name-pattern=${RegExp.escape("a.b (c)")}`, `--test-name-pattern=${RegExp.escape("second")}`,
        "--test-reporter=spec", "--test-reporter-destination=stdout", "--test-reporter=tap", `--test-reporter-destination=${path.join(repository.directory, "_build", "script-tests.tap")}`,
        "scripts/tests/alpha.test.ts", "scripts/tests/beta.test.ts", "scripts/tests/deep/gamma.test.ts"
      ]);
    });

    test("a name that matches no test selects nothing and passes, and a run that wrote no report fails", async t => {
      const repository = await ScriptTestCheckTests.createRepositoryAsync(t);

      const none = await new ScriptTestCheck(repository.directory, new TapRunnerFixture([0], "TAP version 13\nok 1 - scripts/tests/alpha.test.ts\nok 2 - scripts/tests/beta.test.ts\n")).runSelectedAsync(["nothing"]);
      const empty = await new ScriptTestCheck(repository.directory, new TapRunnerFixture([0], "TAP version 13\n")).runSelectedAsync(["nothing"]);
      const unwritten = await new ScriptTestCheck(repository.directory, new TapRunnerFixture([1], null)).runSelectedAsync(["nothing"]);

      assert.deepEqual([none.isPassing, none.discovered, none.selected], [true, 3, 0]);
      assert.deepEqual([empty.isPassing, empty.selected], [true, 0]);
      assert.deepEqual([unwritten.isPassing, unwritten.selected], [false, 0]);
    });
  }

  private static async createRepositoryAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({ "scripts/tests/alpha.test.ts": "", "scripts/tests/beta.test.ts": "", "scripts/tests/deep/gamma.test.ts": "", "scripts/other.ts": "" });
    return repository;
  }
}

ScriptTestCheckTests.register();
