/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import type CheckSelection from "../../checks/check-selection.ts";
import FlakyRecord from "../../checks/flaky-record.ts";
import FlakyTest from "../../checks/flaky-test.ts";
import PackageTestCheck from "../../checks/package-test-check.ts";
import PackageException from "../../packages/package.exception.ts";
import FailingProcessRunnerFixture from "../fixtures/failing-process-runner.fixture.ts";
import PackageBuildFixture from "../fixtures/package-build.fixture.ts";
import PackageTreeFixture from "../fixtures/package-tree.fixture.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class ResultRunnerFixture extends ProcessRunnerFixture {
  private readonly result: string | null;
  private readonly coverage: string | null;

  public constructor(exitCodes: readonly (number | null)[], result: string | null, coverage: string | null = null) {
    super(exitCodes);

    this.result = result;
    this.coverage = coverage;
  }

  public override async runAsync(command: string, commandArguments: readonly string[], directory: string, environment?: NodeJS.ProcessEnv): Promise<number | null> {
    for (const [variable, content] of [["TEAMRUN_TEST_RESULT_FILE", this.result], ["TEAMRUN_COVERAGE_RESULT_FILE", this.coverage]]) {
      const file = environment?.[String(variable)];
      if (file !== undefined && content !== null)
        await writeFile(file, String(content));
    }
    return super.runAsync(command, commandArguments, directory, environment);
  }
}

class ResultsRunnerFixture extends ProcessRunnerFixture {
  private static readonly RESULT: string = JSON.stringify({ passed: 0, failed: 0, skipped: 0, unreached: 0, skips: [], files: [] });

  private readonly results: readonly (string | undefined)[];

  public constructor(exitCodes: readonly (number | null)[], results: readonly (string | undefined)[]) {
    super(exitCodes);

    this.results = results;
  }

  public override async runAsync(command: string, commandArguments: readonly string[], directory: string, environment?: NodeJS.ProcessEnv): Promise<number | null> {
    const file = environment?.["TEAMRUN_TEST_RESULTS_FILE"];
    const results = this.results[this.runs.length];
    if (file !== undefined && results !== undefined)
      await writeFile(file, results);
    const result = environment?.["TEAMRUN_TEST_RESULT_FILE"];
    if (result !== undefined)
      await writeFile(result, ResultsRunnerFixture.RESULT);
    return super.runAsync(command, commandArguments, directory, environment);
  }
}

class PackageTestCheckTests {
  public static register(): void {
    test("a tree without tested packages passes without running anything", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, false);
      const runner = new ProcessRunnerFixture();
      const output = new TextOutputFixture();
      const check = new PackageTestCheck(repository.directory, new PackageBuildFixture(repository.directory), runner, {}, null);

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "No package has tests.\n");
      assert.equal(check.title, "Package tests and coverage");
      assert.equal(runner.runs.length, 0);
    });

    test("the test framework runs every tested package's tests with coverage, then measures every package's coverage", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, true);
      const manifest = path.join(repository.directory, "src", "foundation", "alpha", "package.json");
      const exclusions = [{ file: "main.ts", reason: "Runs only inside Electron." }];
      await writeFile(manifest, JSON.stringify({ ...JSON.parse(await readFile(manifest, "utf8")) as object, teamrun: { coverageExclusions: exclusions } }));
      const runner = new ResultRunnerFixture([0, 0], PackageTestCheckTests.result(2, 2));
      const check = new PackageTestCheck(repository.directory, new PackageBuildFixture(repository.directory), runner, { KEPT: "yes" }, null);

      assert.equal(await check.runAsync(new TextOutputFixture()), true);
      const services = path.join(repository.directory, "node_modules", "@noldova", "teamrun-foundation-testing", "services");
      const coverage = path.join(repository.directory, "_build", "coverage");
      assert.deepEqual(runner.runs[0], [
        process.execPath,
        repository.directory,
        "--enable-source-maps",
        path.join(services, "execution", "test-run-entry.js"),
        "@noldova/teamrun-foundation-testing",
        path.join(repository.directory, "_build", "tests", "foundation-testing"),
        "@noldova/teamrun-foundation-alpha",
        path.join(repository.directory, "_build", "tests", "foundation-alpha")
      ]);
      assert.deepEqual(runner.environments[0], { KEPT: "yes", TEAMRUN_TEST_FILTERS: "[]", TEAMRUN_TEST_RESULT_FILE: path.join(repository.directory, "_build", "test-result.json"), NODE_V8_COVERAGE: coverage });
      assert.deepEqual(runner.runs[1], [
        process.execPath,
        repository.directory,
        "--disable-warning=ExperimentalWarning",
        path.join(services, "coverage", "coverage-run-entry.js"),
        coverage,
        "@noldova/teamrun-foundation-testing",
        path.join(repository.directory, "node_modules", "@noldova", "teamrun-foundation-testing"),
        path.join(repository.directory, "src", "foundation", "testing", "src"),
        "[]",
        "[]",
        "@noldova/teamrun-foundation-alpha",
        path.join(repository.directory, "node_modules", "@noldova", "teamrun-foundation-alpha"),
        path.join(repository.directory, "src", "foundation", "alpha", "src"),
        "[{\"file\":\"main.ts\",\"reason\":\"Runs only inside Electron.\"}]",
        "[]"
      ]);
      assert.deepEqual(runner.environments[1], { KEPT: "yes", TEAMRUN_COVERAGE_RESULT_FILE: path.join(repository.directory, "_build", "package-coverage.json") });
    });

    test("the runner's result and the measured coverage become the package tests' totals, and a run fails without a readable result or with counts that disagree", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, true);
      const build = new PackageBuildFixture(repository.directory);
      const run = async (result: string | null, coverage: string | null): Promise<readonly unknown[]> => {
        const output = new TextOutputFixture();
        return [await new PackageTestCheck(repository.directory, build, new ResultRunnerFixture([0, 0], result, coverage), {}, null).runAsync(output), output.text];
      };
      const skipped = JSON.stringify({
        discovered: 3,
        selected: 3,
        passed: 2,
        failed: 0,
        skipped: 1,
        unreached: 0,
        skips: [{ file: "@noldova/teamrun-foundation-alpha/alpha.test.js", names: ["AlphaTests.pending"], reason: "Waits for the shell." }],
        files: ["@noldova/teamrun-foundation-alpha/alpha.test.js"]
      });

      const recorded = await run(skipped, JSON.stringify({ covered: 9, total: 10 }));
      const totals = JSON.parse(await readFile(path.join(repository.directory, "_build", "totals", "package.json"), "utf8"));
      const disagreeing = await run(JSON.stringify({ discovered: 4, selected: 4, passed: 3, failed: 0, skipped: 0, unreached: 0, skips: [], files: [] }), null);
      const unwritten = await run(null, null);

      assert.deepEqual(recorded, [true, ""]);
      assert.deepEqual(totals, {
        version: 1,
        runner: "package",
        title: "Package tests",
        discovered: 3,
        executed: 2,
        passed: 2,
        failed: 0,
        skipped: 1,
        unselected: 0,
        unreached: 0,
        skips: [{ test: "@noldova/teamrun-foundation-alpha/alpha.test.js › AlphaTests.pending", reason: "Waits for the shell." }],
        files: ["@noldova/teamrun-foundation-alpha/alpha.test.js"],
        coverage: { unit: "files", covered: 9, total: 10 }
      });
      assert.deepEqual(disagreeing, [false, "Package tests don't add up: 4 discovered, but 3 executed, 0 skipped, 0 unselected and 0 unreached.\n"]);
      assert.deepEqual(unwritten, [false, "The test runner wrote no result to _build/test-result.json.\n"]);
    });

    test("a package selection runs only the selected packages' tests and measures only their coverage", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, true);
      const runner = new ResultRunnerFixture([0, 0], PackageTestCheckTests.result(2, 2));
      const output = new TextOutputFixture();
      const check = new PackageTestCheck(repository.directory, new PackageBuildFixture(repository.directory), runner, {}, null, ["@noldova/teamrun-foundation-alpha", "@noldova/teamrun-foundation-alpha"]);

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "Testing 1 of 2 packages, with their coverage: @noldova/teamrun-foundation-alpha.\n");
      assert.deepEqual(runner.runs[0]?.slice(4), ["@noldova/teamrun-foundation-alpha", path.join(repository.directory, "_build", "tests", "foundation-alpha")]);
      assert.deepEqual(runner.runs[1]?.slice(5), [
        "@noldova/teamrun-foundation-alpha",
        path.join(repository.directory, "node_modules", "@noldova", "teamrun-foundation-alpha"),
        path.join(repository.directory, "src", "foundation", "alpha", "src"),
        "[]",
        "[]"
      ]);
    });

    test("a package selection naming no package fails with the packages there are, before running anything", async t => {
      const tested = await PackageTestCheckTests.createRepositoryAsync(t, true);
      const empty = await PackageTestCheckTests.createRepositoryAsync(t, false);
      const runner = new ProcessRunnerFixture();
      const output = new TextOutputFixture();

      assert.equal(await new PackageTestCheck(tested.directory, new PackageBuildFixture(tested.directory), runner, {}, null, ["foundation-alpha", "@noldova/teamrun-foundation-alpha"]).runAsync(output), false);
      assert.equal(await new PackageTestCheck(empty.directory, new PackageBuildFixture(empty.directory), runner, {}, null, ["alpha"]).runAsync(output), false);

      assert.equal(output.text, "No package is named foundation-alpha. The packages are @noldova/teamrun-foundation-testing, @noldova/teamrun-foundation-alpha.\nNo package is named alpha. The packages are none.\n");
      assert.equal(runner.runs.length, 0);
    });

    test("a filtered run passes its filters to the test framework, measures no coverage and reports what it selected", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, true);
      const runner = new ResultRunnerFixture([0], PackageTestCheckTests.result(10, 3));
      const check = new PackageTestCheck(repository.directory, new PackageBuildFixture(repository.directory), runner, { KEPT: "yes" }, null);

      const selection = await check.runSelectedAsync(["Alpha", "category:fast"], new TextOutputFixture());

      assert.deepEqual([selection.isPassing, selection.unit, selection.discovered, selection.selected, selection.unselected], [true, "package tests", 10, 3, 7]);
      assert.equal(runner.runs.length, 1);
      assert.deepEqual(runner.environments[0], {
        KEPT: "yes",
        TEAMRUN_TEST_FILTERS: JSON.stringify(["Alpha", "category:fast"]),
        TEAMRUN_TEST_RESULT_FILE: path.join(repository.directory, "_build", "test-result.json")
      });
    });

    test("a filtered run takes the runner's result, including for no selected package test, and fails when it reported nothing readable", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, true);
      const build = new PackageBuildFixture(repository.directory);
      const run = (exitCode: number, selection: string | null): Promise<CheckSelection> =>
        new PackageTestCheck(repository.directory, build, new ResultRunnerFixture([exitCode], selection), {}, null).runSelectedAsync(["Alpha"], new TextOutputFixture());

      const failing = await run(1, PackageTestCheckTests.result(10, 3));
      const none = await run(0, PackageTestCheckTests.result(10, 0));
      const brokenNone = await run(1, PackageTestCheckTests.result(10, 0));
      const unreadable: CheckSelection[] = [];
      for (const selection of [null, "{", "null", JSON.stringify({ discovered: 10 }), JSON.stringify({ discovered: "10", selected: 1 })])
        unreadable.push(await run(0, selection));

      assert.deepEqual([failing.isPassing, failing.selected], [false, 3]);
      assert.deepEqual([none.isPassing, none.selected, none.unselected], [true, 0, 10]);
      assert.deepEqual([brokenNone.isPassing, brokenNone.selected], [false, 0]);
      assert.deepEqual(unreadable.map(t => [t.isPassing, t.discovered, t.selected]), Array.from({ length: 5 }, () => [false, 0, 0]));
    });

    test("a filtered run fails with the reason when the framework discovered no package test at all", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, true);
      const runner = new ResultRunnerFixture([0], PackageTestCheckTests.result(0, 0));
      const output = new TextOutputFixture();

      const selection = await new PackageTestCheck(repository.directory, new PackageBuildFixture(repository.directory), runner, {}, null).runSelectedAsync(["Alpha"], output);

      assert.deepEqual([selection.isPassing, selection.discovered, selection.selected], [false, 0, 0]);
      assert.equal(output.text, "Packages have test output, but the test framework discovered no test in it.\n");
    });

    test("failing tests or incomplete coverage fail the check, and both still run", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, true);
      const runner = new ResultRunnerFixture([1, 0, 0, 1], PackageTestCheckTests.result(2, 2));
      const check = new PackageTestCheck(repository.directory, new PackageBuildFixture(repository.directory), runner, {}, null);

      assert.equal(await check.runAsync(new TextOutputFixture()), false);
      assert.equal(await check.runAsync(new TextOutputFixture()), false);
      assert.equal(runner.runs.length, 4);
    });

    test("tests without the test framework fail the check", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, false);
      await PackageTreeFixture.writePackageAsync(repository, "foundation-alpha", []);
      await mkdir(path.join(repository.directory, "_build", "tests", "foundation-alpha"), { recursive: true });
      const output = new TextOutputFixture();

      assert.equal(await new PackageTestCheck(repository.directory, new PackageBuildFixture(repository.directory), new ProcessRunnerFixture(), {}, null).runAsync(output), false);
      assert.equal(output.text, "Packages have tests, but @noldova/teamrun-foundation-testing is not a package under src/.\n");
    });

    test("stale artifacts and a test run that cannot start fail the check, and other errors are not hidden", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, true);
      const stale = new TextOutputFixture();
      const unstarted = new TextOutputFixture();

      const staleBuild = new PackageBuildFixture(repository.directory, new PackageException("The built artifacts are stale."));
      assert.equal(await new PackageTestCheck(repository.directory, staleBuild, new ProcessRunnerFixture(), {}, null).runAsync(stale), false);
      assert.equal(await new PackageTestCheck(repository.directory, new PackageBuildFixture(repository.directory), new FailingProcessRunnerFixture(), {}, null).runAsync(unstarted), false);
      const broken = new PackageBuildFixture(repository.directory, new RangeError("unexpected"));
      await assert.rejects(new PackageTestCheck(repository.directory, broken, new ProcessRunnerFixture(), {}, null).runAsync(new TextOutputFixture()), RangeError);

      assert.equal(stale.text, "The built artifacts are stale.\n");
      assert.equal(unstarted.text, `"${process.execPath}" could not start.\n`);
    });

    test("with flaky tests recorded, the package tests write their results, and a passing run records nothing", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, true);
      const results = path.join(repository.directory, "_build", "package-test-results.json");
      await writeFile(results, "stale");
      const runner = new ResultsRunnerFixture([0, 0], []);
      const output = new TextOutputFixture();

      assert.equal(await PackageTestCheckTests.createRecording(repository, runner).runAsync(output), true);

      assert.equal(runner.runs.length, 2);
      assert.deepEqual(runner.environments[0], {
        TEAMRUN_TEST_FILTERS: "[]",
        TEAMRUN_TEST_RESULT_FILE: path.join(repository.directory, "_build", "test-result.json"),
        NODE_V8_COVERAGE: path.join(repository.directory, "_build", "coverage"),
        TEAMRUN_TEST_RESULTS_FILE: results
      });
      assert.deepEqual([existsSync(results), existsSync(PackageTestCheckTests.record(repository)), output.text], [false, false, ""]);
    });

    test("failed package tests run once more by name with the same coverage, keeping the first run's result for the totals, and the tests that pass then are recorded as flaky with their first failure", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, true);
      const file = "@noldova/teamrun-foundation-alpha/alpha.test.js";
      const first = JSON.stringify({ isComplete: true, failed: [{ identity: "AlphaTests.fails", file, failure: "AssertFailedException: once" }] });
      const runner = new ResultsRunnerFixture([1, 0, 0], [first, JSON.stringify({ isComplete: true, failed: [] })]);
      const output = new TextOutputFixture();

      assert.equal(await PackageTestCheckTests.createRecording(repository, runner).runAsync(output), true);

      const coverage = path.join(repository.directory, "_build", "coverage");
      const results = path.join(repository.directory, "_build", "package-test-results.json");
      assert.deepEqual(runner.runs[1], runner.runs[0]);
      assert.deepEqual(runner.environments[1], {
        TEAMRUN_TEST_FILTERS: "[\"AlphaTests.fails\"]",
        NODE_V8_COVERAGE: coverage,
        TEAMRUN_TEST_RESULTS_FILE: results,
        TEAMRUN_TEST_RESULT_FILE: path.join(repository.directory, "_build", "test-rerun-result.json")
      });
      assert.deepEqual(FlakyRecord.parse(await readFile(PackageTestCheckTests.record(repository), "utf8")),
        [new FlakyTest("Package tests", file, "AlphaTests.fails", "AssertFailedException: once")]);
      assert.equal(output.text, "Running the failed package tests once more.\nFlaky, passed when run again: AlphaTests.fails (@noldova/teamrun-foundation-alpha/alpha.test.js)\n");
    });

    test("failed package tests are not run again when their results are missing, unreadable, incomplete or name no failed test", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, true);
      const failed = [{ identity: "AlphaTests.fails", file: "a.js", failure: "once" }];
      const unusable = [
        undefined, "{", "null", "[]", JSON.stringify({ isComplete: "yes", failed }), JSON.stringify({ isComplete: true, failed: {} }),
        JSON.stringify({ isComplete: true, failed: [null] }), JSON.stringify({ isComplete: true, failed: [{ identity: "AlphaTests.fails", file: "a.js" }] }),
        JSON.stringify({ isComplete: false, failed }), JSON.stringify({ isComplete: true, failed: [] })
      ];

      for (const results of unusable) {
        const runner = new ResultsRunnerFixture([1, 0], [results]);
        const output = new TextOutputFixture();

        assert.equal(await PackageTestCheckTests.createRecording(repository, runner).runAsync(output), false);
        assert.deepEqual([runner.runs.length, output.text], [2, ""]);
      }
      assert.equal(existsSync(PackageTestCheckTests.record(repository)), false);
    });

    test("package tests that fail again fail the check and record only the tests that passed then, and second results that are missing or incomplete record nothing", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, true);
      const always = { identity: "AlphaTests.always", file: "a.js", failure: "always" };
      const first = JSON.stringify({ isComplete: true, failed: [{ identity: "AlphaTests.fails", file: "a.js", failure: "once" }, always] });
      const unrecorded = [[1, undefined], [1, JSON.stringify({ isComplete: false, failed: [] })], [0, first]] as const;

      for (const [exitCode, second] of unrecorded) {
        const runner = new ResultsRunnerFixture([1, exitCode, 0], [first, second]);

        assert.equal(await PackageTestCheckTests.createRecording(repository, runner).runAsync(new TextOutputFixture()), false);
        assert.equal(runner.runs.length, 3);
      }
      assert.equal(existsSync(PackageTestCheckTests.record(repository)), false);
      const output = new TextOutputFixture();
      const runner = new ResultsRunnerFixture([1, 1, 0], [first, JSON.stringify({ isComplete: true, failed: [always] })]);

      assert.equal(await PackageTestCheckTests.createRecording(repository, runner).runAsync(output), false);

      assert.deepEqual(FlakyRecord.parse(await readFile(PackageTestCheckTests.record(repository), "utf8")), [new FlakyTest("Package tests", "a.js", "AlphaTests.fails", "once")]);
      assert.ok(output.text.endsWith("Flaky, passed when run again: AlphaTests.fails (a.js)\n"), output.text);
    });
  }

  private static createRecording(repository: RepositoryFixture, runner: ProcessRunnerFixture): PackageTestCheck {
    return new PackageTestCheck(repository.directory, new PackageBuildFixture(repository.directory), runner, {}, new FlakyRecord(repository.directory, {}));
  }

  private static record(repository: RepositoryFixture): string {
    return path.join(repository.directory, "_build", "flaky-tests.json");
  }

  private static result(discovered: number, selected: number): string {
    return JSON.stringify({ discovered, selected, passed: selected, failed: 0, skipped: 0, unreached: 0, skips: [], files: [] });
  }

  private static async createRepositoryAsync(t: TestContext, withTests: boolean): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await PackageTreeFixture.writeRootAsync(repository);
    if (withTests) {
      await PackageTreeFixture.writePackageAsync(repository, "foundation-testing", []);
      await PackageTreeFixture.writePackageAsync(repository, "foundation-alpha", ["foundation-testing"]);
      for (const id of ["foundation-testing", "foundation-alpha"])
        await mkdir(path.join(repository.directory, "_build", "tests", id), { recursive: true });
    }
    return repository;
  }
}

PackageTestCheckTests.register();
