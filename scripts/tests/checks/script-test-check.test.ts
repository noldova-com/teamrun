/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import FlakyRecord from "../../checks/flaky-record.ts";
import FlakyTest from "../../checks/flaky-test.ts";
import ScriptTestCheck from "../../checks/script-test-check.ts";
import PackageException from "../../packages/package.exception.ts";
import PackageBuildFixture from "../fixtures/package-build.fixture.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

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

class RerunRunnerFixture extends ProcessRunnerFixture {
  private readonly written: readonly { report?: string; state?: string }[];

  public constructor(exitCodes: readonly (number | null)[], written: readonly { report?: string; state?: string }[]) {
    super(exitCodes);

    this.written = written;
  }

  public override async runAsync(command: string, commandArguments: readonly string[], directory: string, environment?: NodeJS.ProcessEnv): Promise<number | null> {
    const files = this.written[this.runs.length];
    const report = commandArguments.find(t => t.startsWith("--test-reporter-destination=") && !t.endsWith("=stdout"));
    const state = commandArguments.find(t => t.startsWith("--test-rerun-failures="));
    if (report !== undefined && files?.report !== undefined)
      await writeFile(report.slice("--test-reporter-destination=".length), files.report);
    if (state !== undefined && files?.state !== undefined)
      await writeFile(state.slice("--test-rerun-failures=".length), files.state);
    return super.runAsync(command, commandArguments, directory, environment);
  }
}

class ScriptTestCheckTests {
  public static register(): void {
    test("Node's test runner runs every script test with V8 coverage in a fresh folder, foundation's coverage run then measures the scripts outside their tests, and both must pass", async t => {
      const repository = await ScriptTestCheckTests.createRepositoryAsync(t);
      const coverage = path.join(repository.directory, "_build", "script-coverage");
      await repository.writeAsync({ "_build/script-coverage/coverage-old.json": "{}" });
      const runner = new ProcessRunnerFixture([0, 0, 1, 0, 0, null]);
      const check = new ScriptTestCheck(repository.directory, new PackageBuildFixture(repository.directory), runner, { KEPT: "yes", GITHUB_STEP_SUMMARY: "summary.md" }, null);

      assert.equal(await check.runAsync(new TextOutputFixture()), true);
      assert.deepEqual(await readdir(coverage), []);
      assert.equal(await check.runAsync(new TextOutputFixture()), false);
      assert.equal(await check.runAsync(new TextOutputFixture()), false);

      assert.deepEqual(runner.runs.slice(0, 2), [
        [process.execPath, repository.directory, "--test", "--test-timeout=30000", "scripts/tests/**/*.test.ts"],
        [
          process.execPath,
          repository.directory,
          "--disable-warning=ExperimentalWarning",
          path.join(repository.directory, "node_modules", "@noldova", "teamrun-foundation-testing", "services", "coverage", "coverage-run-entry.js"),
          coverage,
          "scripts",
          path.join(repository.directory, "scripts"),
          path.join(repository.directory, "scripts"),
          "[]",
          "[\"tests\"]"
        ]
      ]);
      assert.deepEqual(runner.environments.slice(0, 2), [{ KEPT: "yes", GITHUB_STEP_SUMMARY: "summary.md", NODE_V8_COVERAGE: coverage }, { KEPT: "yes" }]);
      assert.equal(check.title, "Script tests and coverage");
    });

    test("a missing or stale build fails the check before any test runs, and other errors are not hidden", async t => {
      const repository = await ScriptTestCheckTests.createRepositoryAsync(t);
      const output = new TextOutputFixture();
      const runner = new ProcessRunnerFixture();
      const stale = new ScriptTestCheck(repository.directory, new PackageBuildFixture(repository.directory, new PackageException("The built artifacts are stale.")), runner, {}, null);
      const broken = new ScriptTestCheck(repository.directory, new PackageBuildFixture(repository.directory, new Error("Unexpected.")), runner, {}, null);

      assert.equal(await stale.runAsync(output), false);
      await assert.rejects(broken.runAsync(output), /Unexpected\./);
      assert.equal(output.text, "The built artifacts are stale.\n");
      assert.equal(runner.runs.length, 0);
    });

    test("filters that are part of file paths select those files, which run without the coverage gate or a build, and other filters are left to the other runners", async t => {
      const repository = await ScriptTestCheckTests.createRepositoryAsync(t);
      const runner = new ProcessRunnerFixture([0, 1]);
      const check = ScriptTestCheckTests.createUnbuilt(repository.directory, runner);

      const passing = await check.runSelectedAsync(["alpha", "tests/deep", "a spec file's name"]);
      const failing = await check.runSelectedAsync(["beta"]);

      assert.deepEqual([passing.isPassing, passing.unit, passing.discovered, passing.selected, passing.unselected], [true, "script test files", 3, 2, 1]);
      assert.deepEqual([failing.isPassing, failing.discovered, failing.selected], [false, 3, 1]);
      assert.deepEqual(runner.runs, [
        [process.execPath, repository.directory, "--test", "--test-timeout=30000", "scripts/tests/alpha.test.ts", "scripts/tests/deep/gamma.test.ts"],
        [process.execPath, repository.directory, "--test", "--test-timeout=30000", "scripts/tests/beta.test.ts"]
      ]);
    });

    test("filters that are part of no file path select tests by name in every file and count the files whose tests matched", async t => {
      const repository = await ScriptTestCheckTests.createRepositoryAsync(t);
      const runner = new TapRunnerFixture([0, 1, 0], "TAP version 13\nok 1 - first\nnot ok 2 - second\nok 3 - scripts/tests/alpha.test.ts\n");
      const check = ScriptTestCheckTests.createUnbuilt(repository.directory, runner);

      const passing = await check.runSelectedAsync(["a.b (c)", "second"]);
      const failing = await check.runSelectedAsync(["first"]);

      assert.deepEqual([passing.isPassing, passing.discovered, passing.selected, passing.unselected], [true, 3, 2, 1]);
      assert.deepEqual([failing.isPassing, failing.discovered, failing.selected], [false, 3, 2]);
      const everywhere = await ScriptTestCheckTests.createUnbuilt(repository.directory, new TapRunnerFixture([0], "TAP version 13\nok 1 - first\n")).runSelectedAsync(["first"]);
      assert.deepEqual([everywhere.isPassing, everywhere.selected, everywhere.unselected], [true, 3, 0]);
      assert.deepEqual(runner.runs[0], [
        process.execPath, repository.directory, "--test", "--test-timeout=30000", `--test-name-pattern=${RegExp.escape("a.b (c)")}`, `--test-name-pattern=${RegExp.escape("second")}`,
        "--test-reporter=spec", "--test-reporter-destination=stdout", "--test-reporter=tap", `--test-reporter-destination=${path.join(repository.directory, "_build", "script-tests.tap")}`,
        "scripts/tests/alpha.test.ts", "scripts/tests/beta.test.ts", "scripts/tests/deep/gamma.test.ts"
      ]);
    });

    test("a name that matches no test selects nothing and passes, while a file that fails to load or a run that wrote no report fails", async t => {
      const repository = await ScriptTestCheckTests.createRepositoryAsync(t);
      const unmatched = "TAP version 13\nok 1 - scripts/tests/alpha.test.ts\nok 2 - scripts/tests/beta.test.ts\n";

      const none = await ScriptTestCheckTests.createUnbuilt(repository.directory, new TapRunnerFixture([0], `${unmatched}ok 3 - scripts/tests/deep/gamma.test.ts\n`)).runSelectedAsync(["nothing"]);
      const broken = await ScriptTestCheckTests.createUnbuilt(repository.directory, new TapRunnerFixture([1], `${unmatched}not ok 3 - scripts/tests/deep/gamma.test.ts\n`)).runSelectedAsync(["nothing"]);
      const unwritten = await ScriptTestCheckTests.createUnbuilt(repository.directory, new TapRunnerFixture([1], null)).runSelectedAsync(["nothing"]);

      assert.deepEqual([none.isPassing, none.discovered, none.selected], [true, 3, 0]);
      assert.deepEqual([broken.isPassing, broken.selected, broken.unselected], [false, 1, 2]);
      assert.deepEqual([unwritten.isPassing, unwritten.selected], [false, 0]);
    });

    test("with flaky tests recorded, the script tests run once with a rerun state and a report, and a passing run records nothing", async t => {
      const repository = await ScriptTestCheckTests.createRepositoryAsync(t);
      await repository.writeAsync({ "_build/script-test-state.json": "stale", "_build/script-tests.tap": "stale" });
      const runner = new RerunRunnerFixture([0, 0], []);
      const check = new ScriptTestCheck(repository.directory, new PackageBuildFixture(repository.directory), runner, {}, new FlakyRecord(repository.directory, {}));
      const output = new TextOutputFixture();

      assert.equal(await check.runAsync(output), true);

      const state = path.join(repository.directory, "_build", "script-test-state.json");
      const report = path.join(repository.directory, "_build", "script-tests.tap");
      assert.deepEqual(runner.runs[0], [
        process.execPath, repository.directory, "--test", "--test-timeout=30000", `--test-rerun-failures=${state}`,
        "--test-reporter=spec", "--test-reporter-destination=stdout", "--test-reporter=tap", `--test-reporter-destination=${report}`, "scripts/tests/**/*.test.ts"
      ]);
      assert.equal(runner.runs.length, 2);
      assert.deepEqual([existsSync(state), existsSync(report), existsSync(ScriptTestCheckTests.record(repository)), output.text], [false, false, false, ""]);
    });

    test("failed script tests run once more with the same coverage, and the tests that pass then are recorded as flaky with their first failure", async t => {
      const repository = await ScriptTestCheckTests.createRepositoryAsync(t);
      const file = path.join(repository.directory, "scripts", "tests", "alpha.test.ts");
      const first = `TAP version 13\nnot ok 1 - once\n  ---\n  location: '${file}:3:1'\n  error: 'first'\n  ...\n`;
      const state = JSON.stringify([{}, { "scripts/tests/alpha.test.ts:3:1": { name: "once", children: [], passed_on_attempt: 1 } }]);
      const runner = new RerunRunnerFixture([1, 0, 0], [{ report: first }, { report: "TAP version 13\nok 1 - once\n", state }]);
      const output = new TextOutputFixture();

      assert.equal(await new ScriptTestCheck(repository.directory, new PackageBuildFixture(repository.directory), runner, {}, new FlakyRecord(repository.directory, {})).runAsync(output), true);

      const coverage = path.join(repository.directory, "_build", "script-coverage");
      assert.deepEqual(runner.runs[1], runner.runs[0]);
      assert.deepEqual(runner.environments.slice(0, 2), [{ NODE_V8_COVERAGE: coverage }, { NODE_V8_COVERAGE: coverage }]);
      assert.deepEqual(FlakyRecord.parse(await readFile(ScriptTestCheckTests.record(repository), "utf8")),
        [new FlakyTest("Script tests", "scripts/tests/alpha.test.ts", "once", `not ok 1 - once\n  ---\n  location: '${file}:3:1'\n  error: 'first'\n  ...`)]);
      assert.equal(output.text, "Running the failed script tests once more.\nFlaky, passed when run again: once (scripts/tests/alpha.test.ts)\n");
    });

    test("script tests that fail again fail the check, and the tests that passed then are still recorded as flaky", async t => {
      const repository = await ScriptTestCheckTests.createRepositoryAsync(t);
      const state = JSON.stringify([{}, { "scripts/tests/alpha.test.ts:3:1": { name: "once", children: [], passed_on_attempt: 1 } }]);
      const silent = new RerunRunnerFixture([1, 1, 0], []);
      const runner = new RerunRunnerFixture([1, 1, 0], [{ report: "TAP version 13\n" }, { report: "TAP version 13\n", state }]);

      assert.equal(await new ScriptTestCheck(repository.directory, new PackageBuildFixture(repository.directory), silent, {}, new FlakyRecord(repository.directory, {})).runAsync(new TextOutputFixture()), false);
      assert.deepEqual([silent.runs.length, existsSync(ScriptTestCheckTests.record(repository))], [3, false]);
      assert.equal(await new ScriptTestCheck(repository.directory, new PackageBuildFixture(repository.directory), runner, {}, new FlakyRecord(repository.directory, {})).runAsync(new TextOutputFixture()), false);

      assert.deepEqual(FlakyRecord.parse(await readFile(ScriptTestCheckTests.record(repository), "utf8")), [new FlakyTest("Script tests", "scripts/tests/alpha.test.ts", "once", "")]);
    });

    test("a rerun that passes without naming a flaky test records the whole run with its first report, or with no failure when it wrote none", async t => {
      const repository = await ScriptTestCheckTests.createRepositoryAsync(t);
      const unnamed = "A run that failed and passed when run again, naming no test";
      const reported = new RerunRunnerFixture([1, 0, 0], [{ report: "TAP version 13\nnot ok 1 - scripts/tests/beta.test.ts\n" }, { state: "[{}]" }]);
      const silent = new RerunRunnerFixture([1, 0, 0], []);
      const check = (runner: ProcessRunnerFixture): ScriptTestCheck => new ScriptTestCheck(repository.directory, new PackageBuildFixture(repository.directory), runner, {}, new FlakyRecord(repository.directory, {}));

      assert.equal(await check(reported).runAsync(new TextOutputFixture()), true);
      assert.equal(await check(silent).runAsync(new TextOutputFixture()), true);

      assert.deepEqual(FlakyRecord.parse(await readFile(ScriptTestCheckTests.record(repository), "utf8")), [
        new FlakyTest("Script tests", "scripts/tests", unnamed, "TAP version 13\nnot ok 1 - scripts/tests/beta.test.ts\n"),
        new FlakyTest("Script tests", "scripts/tests", unnamed, "")
      ]);
    });
  }

  private static record(repository: RepositoryFixture): string {
    return path.join(repository.directory, "_build", "flaky-tests.json");
  }

  private static createUnbuilt(directory: string, runner: ProcessRunnerFixture): ScriptTestCheck {
    return new ScriptTestCheck(directory, new PackageBuildFixture(directory, new PackageException("Nothing is built.")), runner, {}, null);
  }

  private static async createRepositoryAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({ "scripts/tests/alpha.test.ts": "", "scripts/tests/beta.test.ts": "", "scripts/tests/deep/gamma.test.ts": "", "scripts/other.ts": "" });
    return repository;
  }
}

ScriptTestCheckTests.register();
