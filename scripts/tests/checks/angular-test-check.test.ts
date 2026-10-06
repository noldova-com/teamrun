/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import AngularProject from "../../angular/angular-project.ts";
import AngularTestRun from "../../angular/angular-test-run.ts";
import AngularTestCheck from "../../checks/angular-test-check.ts";
import ProcessException from "../../processes/process.exception.ts";
import NpmCommand from "../../toolchain/npm-command.ts";
import RunnerResult from "../../totals/runner-result.ts";
import TotalsException from "../../totals/totals.exception.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class AngularProjectFixture extends AngularProject {
  private readonly run: AngularTestRun | Error;
  private readonly specFiles: readonly string[] | Error;

  public readonly included: (readonly string[])[] = [];

  public constructor(run: AngularTestRun | Error, specFiles: readonly string[] | Error = [], root: string = "root") {
    const runner = new ProcessRunnerFixture();
    super(root, runner, new NpmCommand(runner, {}));

    this.run = run;
    this.specFiles = specFiles;
  }

  public override async testAsync(include: readonly string[] = []): Promise<AngularTestRun> {
    this.included.push(include);
    if (this.run instanceof Error)
      throw this.run;
    return this.run;
  }

  public override async specFilesAsync(): Promise<readonly string[]> {
    if (this.specFiles instanceof Error)
      throw this.specFiles;
    return this.specFiles;
  }
}

class AngularTestCheckTests {
  private static readonly LOG_HINT: string = "The Angular tests' full output is in _build/angular-tests.log.\n";

  public static register(): void {
    test("the check passes when the Angular tests and their coverage gate pass and every spec file ran", async t => {
      const output = new TextOutputFixture();
      const check = new AngularTestCheck(new AngularProjectFixture(AngularTestCheckTests.run(0, ["a.spec.ts", "b.spec.ts"]), ["a.spec.ts", "b.spec.ts"], await AngularTestCheckTests.createRootAsync(t)));

      assert.equal(check.title, "Angular tests and coverage");
      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "");
    });

    test("the check fails when the tests fail, without listing the spec files, and names the log of their output", async () => {
      const output = new TextOutputFixture();

      assert.equal(await new AngularTestCheck(new AngularProjectFixture(AngularTestCheckTests.run(1, null), new Error("not listed"))).runAsync(output), false);
      assert.equal(output.text, AngularTestCheckTests.LOG_HINT);
    });

    test("the check fails and names the spec files a passing run did not run", async t => {
      const output = new TextOutputFixture();
      const check = new AngularTestCheck(new AngularProjectFixture(AngularTestCheckTests.run(0, ["a.spec.ts"]), ["a.spec.ts", "shell/b.spec.ts", "shell/c.spec.ts"], await AngularTestCheckTests.createRootAsync(t)));

      assert.equal(await check.runAsync(output), false);
      assert.equal(output.text, `Angular tests have no result for these files:\n  shell/b.spec.ts\n  shell/c.spec.ts\n${AngularTestCheckTests.LOG_HINT}`);
    });

    test("the check names the duplicate tests and the empty spec files of a run, even one that failed", async t => {
      const output = new TextOutputFixture();
      const result = RunnerResult.parse(JSON.stringify({
        passed: 2,
        failed: 1,
        skipped: 0,
        unreached: 0,
        skips: [],
        files: ["a.spec.ts", "b.spec.ts"],
        duplicates: [{ file: "a.spec.ts", names: ["A", "same"] }],
        empty: ["b.spec.ts"]
      }), "report");
      const check = new AngularTestCheck(new AngularProjectFixture(new AngularTestRun(1, result, null), ["a.spec.ts", "b.spec.ts"], await AngularTestCheckTests.createRootAsync(t)));

      assert.equal(await check.runAsync(output), false);
      assert.equal(output.text, `Angular tests name more than one test the same:\n  a.spec.ts › A › same\nAngular tests found no tests in these files:\n  b.spec.ts\n${AngularTestCheckTests.LOG_HINT}`);
    });

    test("the check fails when a passing run wrote no report, or its report or workspace cannot be read", async t => {
      const silent = new TextOutputFixture();
      const unreadable = new TextOutputFixture();
      const workspace = new TextOutputFixture();
      const root = await AngularTestCheckTests.createRootAsync(t);

      assert.equal(await new AngularTestCheck(new AngularProjectFixture(AngularTestCheckTests.run(0, null))).runAsync(silent), false);
      assert.equal(await new AngularTestCheck(new AngularProjectFixture(new ProcessException("The report is unreadable."))).runAsync(unreadable), false);
      assert.equal(await new AngularTestCheck(new AngularProjectFixture(AngularTestCheckTests.run(0, []), new ProcessException("No include patterns."), root)).runAsync(workspace), false);
      assert.deepEqual([silent.text, unreadable.text, workspace.text],
        ["The Angular tests passed but wrote no report of the spec files they ran.\n", "The report is unreadable.\n", "No include patterns.\n"].map(t => `${t}${AngularTestCheckTests.LOG_HINT}`));
    });

    test("a filtered run runs only the spec files whose paths contain a filter and reports what it selected", async () => {
      const output = new TextOutputFixture();
      const project = new AngularProjectFixture(AngularTestCheckTests.run(0, ["shell/a.spec.ts", "shell/b.spec.ts"]), ["modules/c.spec.ts", "shell/a.spec.ts", "shell/b.spec.ts"]);

      const selection = await new AngularTestCheck(project).runSelectedAsync(["shell/", "nothing"], output);

      assert.deepEqual([selection.isPassing, selection.unit, selection.discovered, selection.selected, selection.unselected], [true, "spec files", 3, 2, 1]);
      assert.deepEqual(project.included, [["shell/a.spec.ts", "shell/b.spec.ts"]]);
      assert.equal(output.text, "");
    });

    test("a filtered run that selects no spec file runs nothing and passes", async () => {
      const project = new AngularProjectFixture(new Error("not run"), ["a.spec.ts"]);

      const selection = await new AngularTestCheck(project).runSelectedAsync(["b.spec"], new TextOutputFixture());

      assert.deepEqual([selection.isPassing, selection.discovered, selection.selected], [true, 1, 0]);
      assert.equal(project.included.length, 0);
    });

    test("a filtered run fails when the selected tests fail or do not all run, and names the log of their output", async () => {
      const failed = new TextOutputFixture();
      const incomplete = new TextOutputFixture();

      const failing = await new AngularTestCheck(new AngularProjectFixture(AngularTestCheckTests.run(1, null), ["a.spec.ts", "b.spec.ts"])).runSelectedAsync(["a.spec"], failed);
      const partial = await new AngularTestCheck(new AngularProjectFixture(AngularTestCheckTests.run(0, ["a.spec.ts"]), ["a.spec.ts", "b.spec.ts"])).runSelectedAsync(["spec"], incomplete);

      assert.deepEqual([failing.isPassing, failing.selected, partial.isPassing, partial.selected], [false, 1, false, 2]);
      assert.equal(failed.text, AngularTestCheckTests.LOG_HINT);
      assert.equal(incomplete.text, `Angular tests have no result for these files:\n  b.spec.ts\n${AngularTestCheckTests.LOG_HINT}`);
    });

    test("a filtered run fails when the spec files cannot be listed, and lets an unexpected failure through", async () => {
      const output = new TextOutputFixture();

      const selection = await new AngularTestCheck(new AngularProjectFixture(AngularTestCheckTests.run(0, []), new ProcessException("No include patterns."))).runSelectedAsync(["a"], output);

      assert.deepEqual([selection.isPassing, selection.discovered, selection.selected], [false, 0, 0]);
      assert.equal(output.text, `No include patterns.\n${AngularTestCheckTests.LOG_HINT}`);
      await assert.rejects(new AngularTestCheck(new AngularProjectFixture(AngularTestCheckTests.run(0, []), new Error("broken"))).runSelectedAsync(["a"], new TextOutputFixture()), new Error("broken"));
    });

    test("the check lets an unexpected failure through", async () => {
      await assert.rejects(new AngularTestCheck(new AngularProjectFixture(new Error("broken"))).runAsync(new TextOutputFixture()), new Error("broken"));
    });

    test("a complete run records the Angular tests' totals with their coverage, even when they fail, and fails when its counts disagree or its report cannot be read", async t => {
      const root = await AngularTestCheckTests.createRootAsync(t);
      const totals = path.join(root, "_build", "totals", "angular.json");
      const result = RunnerResult.parse(JSON.stringify({
        passed: 1,
        failed: 1,
        skipped: 1,
        unreached: 0,
        skips: [{ file: "a.spec.ts", names: ["A", "waits"], reason: "No reason given." }],
        files: ["a.spec.ts"]
      }), "report");
      const disagreeing = RunnerResult.parse(JSON.stringify({ passed: 1, failed: 0, skipped: 1, unreached: 0, skips: [], files: ["a.spec.ts"] }), "report");
      const failed = new TextOutputFixture();
      const disagreed = new TextOutputFixture();
      const unreadable = new TextOutputFixture();

      assert.equal(await new AngularTestCheck(new AngularProjectFixture(new AngularTestRun(1, result, { unit: "statements", covered: 7, total: 8 }), ["a.spec.ts"], root)).runAsync(failed), false);
      const recorded = JSON.parse(await readFile(totals, "utf8"));
      assert.equal(await new AngularTestCheck(new AngularProjectFixture(new AngularTestRun(0, disagreeing, null), ["a.spec.ts"], root)).runAsync(disagreed), false);
      assert.equal(await new AngularTestCheck(new AngularProjectFixture(new TotalsException("The report has no count passed."), [], root)).runAsync(unreadable), false);

      assert.deepEqual(recorded, {
        version: 1,
        runner: "angular",
        title: "Angular tests",
        discovered: 3,
        executed: 2,
        passed: 1,
        failed: 1,
        skipped: 1,
        unselected: 0,
        unreached: 0,
        skips: [{ test: "a.spec.ts › A › waits", reason: "No reason given." }],
        files: ["a.spec.ts"],
        coverage: { unit: "statements", covered: 7, total: 8 },
        duplicates: [],
        empty: [],
        missing: []
      });
      assert.equal(failed.text, AngularTestCheckTests.LOG_HINT);
      assert.equal(disagreed.text, `Angular tests name 0 skipped tests but count 1.\n${AngularTestCheckTests.LOG_HINT}`);
      assert.equal(unreadable.text, `The report has no count passed.\n${AngularTestCheckTests.LOG_HINT}`);
    });
  }

  private static run(exitCode: number, files: readonly string[] | null): AngularTestRun {
    const result = files === null ? null : RunnerResult.parse(JSON.stringify({ passed: files.length, failed: 0, skipped: 0, unreached: 0, skips: [], files }), "report");
    return new AngularTestRun(exitCode, result, null);
  }

  private static async createRootAsync(t: TestContext): Promise<string> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    return repository.directory;
  }
}

AngularTestCheckTests.register();
