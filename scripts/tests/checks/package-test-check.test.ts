/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import type CheckSelection from "../../checks/check-selection.ts";
import PackageTestCheck from "../../checks/package-test-check.ts";
import PackageException from "../../packages/package.exception.ts";
import FailingProcessRunnerFixture from "../fixtures/failing-process-runner.fixture.ts";
import PackageBuildFixture from "../fixtures/package-build.fixture.ts";
import PackageTreeFixture from "../fixtures/package-tree.fixture.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class SelectionRunnerFixture extends ProcessRunnerFixture {
  private readonly selection: string | null;

  public constructor(exitCodes: readonly (number | null)[], selection: string | null) {
    super(exitCodes);

    this.selection = selection;
  }

  public override async runAsync(command: string, commandArguments: readonly string[], directory: string, environment?: NodeJS.ProcessEnv): Promise<number | null> {
    const file = environment?.["TEAMRUN_TEST_SELECTION_FILE"];
    if (file !== undefined && this.selection !== null)
      await writeFile(file, this.selection);
    return super.runAsync(command, commandArguments, directory, environment);
  }
}

class PackageTestCheckTests {
  public static register(): void {
    test("a tree without tested packages passes without running anything", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, false);
      const runner = new ProcessRunnerFixture();
      const output = new TextOutputFixture();
      const check = new PackageTestCheck(repository.directory, new PackageBuildFixture(repository.directory), runner, {});

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
      const runner = new ProcessRunnerFixture([0, 0]);
      const check = new PackageTestCheck(repository.directory, new PackageBuildFixture(repository.directory), runner, { KEPT: "yes" });

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
      assert.deepEqual(runner.environments[0], { KEPT: "yes", TEAMRUN_TEST_FILTERS: "[]", NODE_V8_COVERAGE: coverage });
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
      assert.deepEqual(runner.environments[1], { KEPT: "yes" });
    });

    test("a filtered run passes its filters to the test framework, measures no coverage and reports what it selected", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, true);
      const runner = new SelectionRunnerFixture([0], JSON.stringify({ discovered: 10, selected: 3 }));
      const check = new PackageTestCheck(repository.directory, new PackageBuildFixture(repository.directory), runner, { KEPT: "yes" });

      const selection = await check.runSelectedAsync(["Alpha", "category:fast"], new TextOutputFixture());

      assert.deepEqual([selection.isPassing, selection.unit, selection.discovered, selection.selected, selection.unselected], [true, "package tests", 10, 3, 7]);
      assert.equal(runner.runs.length, 1);
      assert.deepEqual(runner.environments[0], {
        KEPT: "yes",
        TEAMRUN_TEST_FILTERS: JSON.stringify(["Alpha", "category:fast"]),
        TEAMRUN_TEST_SELECTION_FILE: path.join(repository.directory, "_build", "test-selection.json")
      });
    });

    test("a filtered run takes the runner's result, including for no selected package test, and fails when it reported nothing readable", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, true);
      const build = new PackageBuildFixture(repository.directory);
      const run = (exitCode: number, selection: string | null): Promise<CheckSelection> =>
        new PackageTestCheck(repository.directory, build, new SelectionRunnerFixture([exitCode], selection), {}).runSelectedAsync(["Alpha"], new TextOutputFixture());

      const failing = await run(1, JSON.stringify({ discovered: 10, selected: 3 }));
      const none = await run(0, JSON.stringify({ discovered: 10, selected: 0 }));
      const brokenNone = await run(1, JSON.stringify({ discovered: 10, selected: 0 }));
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
      const runner = new SelectionRunnerFixture([0], JSON.stringify({ discovered: 0, selected: 0 }));
      const output = new TextOutputFixture();

      const selection = await new PackageTestCheck(repository.directory, new PackageBuildFixture(repository.directory), runner, {}).runSelectedAsync(["Alpha"], output);

      assert.deepEqual([selection.isPassing, selection.discovered, selection.selected], [false, 0, 0]);
      assert.equal(output.text, "Packages have test output, but the test framework discovered no test in it.\n");
    });

    test("failing tests or incomplete coverage fail the check, and both still run", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, true);
      const runner = new ProcessRunnerFixture([1, 0, 0, 1]);
      const check = new PackageTestCheck(repository.directory, new PackageBuildFixture(repository.directory), runner, {});

      assert.equal(await check.runAsync(new TextOutputFixture()), false);
      assert.equal(await check.runAsync(new TextOutputFixture()), false);
      assert.equal(runner.runs.length, 4);
    });

    test("tests without the test framework fail the check", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, false);
      await PackageTreeFixture.writePackageAsync(repository, "foundation-alpha", []);
      await mkdir(path.join(repository.directory, "_build", "tests", "foundation-alpha"), { recursive: true });
      const output = new TextOutputFixture();

      assert.equal(await new PackageTestCheck(repository.directory, new PackageBuildFixture(repository.directory), new ProcessRunnerFixture(), {}).runAsync(output), false);
      assert.equal(output.text, "Packages have tests, but @noldova/teamrun-foundation-testing is not a package under src/.\n");
    });

    test("stale artifacts and a test run that cannot start fail the check, and other errors are not hidden", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, true);
      const stale = new TextOutputFixture();
      const unstarted = new TextOutputFixture();

      const staleBuild = new PackageBuildFixture(repository.directory, new PackageException("The built artifacts are stale."));
      assert.equal(await new PackageTestCheck(repository.directory, staleBuild, new ProcessRunnerFixture(), {}).runAsync(stale), false);
      assert.equal(await new PackageTestCheck(repository.directory, new PackageBuildFixture(repository.directory), new FailingProcessRunnerFixture(), {}).runAsync(unstarted), false);
      const broken = new PackageBuildFixture(repository.directory, new RangeError("unexpected"));
      await assert.rejects(new PackageTestCheck(repository.directory, broken, new ProcessRunnerFixture(), {}).runAsync(new TextOutputFixture()), RangeError);

      assert.equal(stale.text, "The built artifacts are stale.\n");
      assert.equal(unstarted.text, `"${process.execPath}" could not start.\n`);
    });
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
