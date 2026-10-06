/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import AngularProject from "../../angular/angular-project.ts";
import RetriedTest from "../../angular/retried-test.ts";
import ProcessResult from "../../processes/process-result.ts";
import ProcessException from "../../processes/process.exception.ts";
import NpmCommand from "../../toolchain/npm-command.ts";
import TotalsException from "../../totals/totals.exception.ts";
import AngularReportRunnerFixture from "../fixtures/angular-report-runner.fixture.ts";
import MockPausesFixture from "../fixtures/mock-pauses.fixture.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class CoverageReportRunnerFixture extends AngularReportRunnerFixture {
  private readonly summary: string;

  public constructor(summary: string) {
    super(JSON.stringify({ testResults: [] }), [0]);

    this.summary = summary;
  }

  public override async runAsync(command: string, commandArguments: readonly string[], directory: string, environment?: NodeJS.ProcessEnv): Promise<number | null> {
    const folder = path.join(directory, "..", "_build", "angular-coverage");
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "coverage-summary.json"), this.summary);
    return super.runAsync(command, commandArguments, directory, environment);
  }
}

class AngularProjectTests {
  private static readonly NPM: string = "/tools/npm/bin/npm-cli.js";
  private static readonly INSTALLED: ProcessResult = new ProcessResult(0, "", "");
  private static readonly FAILED: ProcessResult = new ProcessResult(1, "", "Error: Download failed\n");

  public static register(): void {
    test("a tree without the Angular project has nothing to prepare", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const runner = new ProcessRunnerFixture();
      const output = new TextOutputFixture();

      await AngularProjectTests.create(repository, runner).prepareAsync(output);

      assert.equal(output.text, "No Angular project under src/; there is nothing to prepare.\n");
      assert.deepEqual([runner.runs, runner.captured], [[], []]);
    });

    test("an uninstalled project is installed with npm ci, stale TeamRun copies are removed, and the test browser is installed", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      await repository.writeAsync({ "src/node_modules/@noldova/teamrun-foundation-core/package.json": "{}\n" });
      const runner = new ProcessRunnerFixture([], [new ProcessResult(0, "added 1 package", ""), AngularProjectTests.INSTALLED]);
      const output = new TextOutputFixture();

      await AngularProjectTests.create(repository, runner).prepareAsync(output);

      const directory = path.join(repository.directory, "src");
      assert.equal(existsSync(path.join(directory, "node_modules", "@noldova")), false);
      assert.deepEqual(runner.captured, [
        [process.execPath, directory, AngularProjectTests.NPM, "ci", "--no-audit", "--no-fund"],
        [process.execPath, directory, path.join(directory, "node_modules", "playwright", "cli.js"), "install", "--only-shell", "chromium"]
      ]);
      assert.deepEqual(runner.runs, []);
      assert.equal(output.text, "Installing the Angular project in src/...\nInstalling the browser for the Angular tests...\n");
      assert.equal(await readFile(path.join(directory, "node_modules", ".teamrun-install"), "utf8"), AngularProjectTests.formatRecord("{}\n"));
    });

    test("an installed project is reinstalled only when its lockfile, platform or CPU differ from the recorded install", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      await repository.writeAsync({ "src/node_modules/.teamrun-install": AngularProjectTests.formatRecord("{}\n"), "src/node_modules/@angular/cli/bin/ng.js": "" });
      const current = new ProcessRunnerFixture([], [AngularProjectTests.INSTALLED]);
      await AngularProjectTests.create(repository, current).prepareAsync(new TextOutputFixture());

      await repository.writeAsync({ "src/package-lock.json": "{ \"lockfileVersion\": 3 }\n" });
      const changed = new ProcessRunnerFixture([], [AngularProjectTests.INSTALLED, AngularProjectTests.INSTALLED]);
      await AngularProjectTests.create(repository, changed).prepareAsync(new TextOutputFixture());
      const afterChange = await readFile(path.join(repository.directory, "src", "node_modules", ".teamrun-install"), "utf8");

      await repository.writeAsync({ "src/node_modules/.teamrun-install": afterChange.replace(process.arch, "other-cpu") });
      const otherCpu = new ProcessRunnerFixture([], [AngularProjectTests.INSTALLED, AngularProjectTests.INSTALLED]);
      await AngularProjectTests.create(repository, otherCpu).prepareAsync(new TextOutputFixture());

      assert.deepEqual([current.captured.length, current.runs.length], [1, 0]);
      assert.deepEqual([changed.captured.length, changed.runs.length], [2, 0]);
      assert.equal(afterChange, AngularProjectTests.formatRecord("{ \"lockfileVersion\": 3 }\n"));
      assert.equal(otherCpu.captured.length, 2);
    });

    test("preparing an installed project removes the test runner's pre-bundled dependencies, so no copy of an earlier build of TeamRun's packages survives", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      const stale = "src/node_modules/.vite/vitest/0123abcd/deps/@noldova_teamrun-shell-protocol.js";
      await repository.writeAsync({
        "src/node_modules/.teamrun-install": AngularProjectTests.formatRecord("{}\n"),
        "src/node_modules/@angular/cli/bin/ng.js": "",
        [stale]: "export class EarlierBuild {}\n"
      });
      const runner = new ProcessRunnerFixture([], [AngularProjectTests.INSTALLED]);

      await AngularProjectTests.create(repository, runner).prepareAsync(new TextOutputFixture());

      assert.equal(runner.captured.length, 1);
      assert.equal(existsSync(path.join(repository.directory, "src", "node_modules", ".vite")), false);
      assert.equal(existsSync(path.join(repository.directory, "src", "node_modules", "@angular", "cli", "bin", "ng.js")), true);
    });

    test("a project without its CLI is reinstalled", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      await repository.writeAsync({ "src/node_modules/.teamrun-install": AngularProjectTests.formatRecord("{}\n") });
      const runner = new ProcessRunnerFixture([], [AngularProjectTests.INSTALLED, AngularProjectTests.INSTALLED]);

      await AngularProjectTests.create(repository, runner).prepareAsync(new TextOutputFixture());

      assert.equal(runner.captured.length, 2);
    });

    test("a failed install stops the preparation with the reason, before the browser is installed", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      await repository.writeAsync({ "src/node_modules/.package-lock.json": "{}\n" });
      const runner = new ProcessRunnerFixture([], [new ProcessResult(1, "", "npm ERR! lockfile out of date\n")]);

      await assert.rejects(
        AngularProjectTests.create(repository, runner).prepareAsync(new TextOutputFixture()),
        new ProcessException("\"npm ci\" in src/ failed with exit code 1: npm ERR! lockfile out of date"));

      assert.equal(runner.captured.length, 1);
    });

    test("a failed browser download is tried again after a pause, and the preparation goes on once an attempt succeeds", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      await repository.writeAsync({ "src/node_modules/.teamrun-install": AngularProjectTests.formatRecord("{}\n"), "src/node_modules/@angular/cli/bin/ng.js": "" });
      const runner = new ProcessRunnerFixture([], [AngularProjectTests.FAILED, AngularProjectTests.FAILED, AngularProjectTests.INSTALLED]);
      const output = new TextOutputFixture();

      await MockPausesFixture.settleAsync(t, () => AngularProjectTests.create(repository, runner).prepareAsync(output), output, () => `${runner.captured.length} attempts started`);

      assert.equal(runner.captured.length, 3);
      assert.equal(output.text, `Installing the browser for the Angular tests...\n${AngularProjectTests.pausing(1)}${AngularProjectTests.pausing(2)}`);
    });

    test("a browser download that fails every time stops the preparation after four attempts with the last attempt's output", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      await repository.writeAsync({ "src/node_modules/.teamrun-install": AngularProjectTests.formatRecord("{}\n"), "src/node_modules/@angular/cli/bin/ng.js": "" });
      const attempts = [1, 2, 3, 4].map(number => new ProcessResult(1, "", `Error: Download failed: attempt ${number}\n`));
      const runner = new ProcessRunnerFixture([], attempts);
      const output = new TextOutputFixture();

      await assert.rejects(
        MockPausesFixture.settleAsync(t, () => AngularProjectTests.create(repository, runner).prepareAsync(output), output, () => `${runner.captured.length} attempts started`),
        new ProcessException("The browser for the Angular tests could not be installed in 4 attempts; the last failed with exit code 1: Error: Download failed: attempt 4."));

      assert.equal(runner.captured.length, 4);
    });

    test("the tests run the Angular CLI in src/ with a JSON report and a log of their output, and give its result and the spec files it ran", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      const directory = path.join(repository.directory, "src");
      const report = path.join(repository.directory, "_build", "angular-tests.json");
      const reporting = new AngularReportRunnerFixture(JSON.stringify({ testResults: [
        { name: path.join(directory, "shell", "b.spec.ts"), status: "passed", assertionResults: [{ ancestorTitles: ["B"], title: "works", status: "passed" }] },
        { name: path.join(directory, "a.spec.ts"), status: "passed", assertionResults: [] }
      ] }), [0]);
      await repository.writeAsync({ "_build/angular-tests.json": "stale", "_build/angular-coverage/coverage-summary.json": "stale" });

      const run = await AngularProjectTests.create(repository, reporting).testAsync([], false);
      const silent = await AngularProjectTests.create(repository, new ProcessRunnerFixture([1])).testAsync([], false);

      assert.deepEqual([run.isSuccessful, run.collected, run.result?.passed, run.coverage], [true, ["a.spec.ts", "shell/b.spec.ts"], 1, null]);
      assert.deepEqual([silent.isSuccessful, silent.exitCode, silent.collected, silent.result, silent.coverage], [false, 1, null, null, null]);
      assert.deepEqual(reporting.runs, [[process.execPath, directory, path.join(directory, "node_modules", "@angular", "cli", "bin", "ng.js"), "test", "--reporters=default", "--reporters=json", "--output-file", report]]);
      assert.deepEqual(reporting.logs, [path.join(repository.directory, "_build", "angular-tests.log")]);
      assert.equal(AngularProject.LOG_FILE, "_build/angular-tests.log");
    });

    test("a run takes the statements its coverage covered from the coverage summary, and a summary without them is refused", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      const summary = { total: { lines: { total: 9, covered: 9 }, statements: { total: 10, covered: 8, skipped: 0, pct: 80 } } };

      const run = await AngularProjectTests.create(repository, new CoverageReportRunnerFixture(JSON.stringify(summary))).testAsync([], false);

      assert.deepEqual(run.coverage, { unit: "statements", covered: 8, total: 10 });
      await assert.rejects(AngularProjectTests.create(repository, new CoverageReportRunnerFixture(JSON.stringify({ total: { lines: {} } }))).testAsync([], false),
        new TotalsException("_build/angular-coverage/coverage-summary.json, total, statements, is not a JSON object."));
    });

    test("a retrying run asks the tests to retry once, and each test that passed after failing is flaky with its first failure", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      const directory = path.join(repository.directory, "src");
      const report = JSON.stringify({
        testResults: [
          {
            name: path.join(directory, "shell", "a.spec.ts"),
            status: "failed",
            assertionResults: [
              { ancestorTitles: ["A"], title: "retries", status: "passed", fullName: "A retries", failureMessages: ["Error: first", "Error: second"] },
              { ancestorTitles: ["A"], title: "passes", status: "passed", fullName: "A passes", failureMessages: [] },
              { ancestorTitles: ["A"], title: "fails", status: "failed", fullName: "A fails", failureMessages: ["Error: always"] },
              { ancestorTitles: ["A"], title: "reports no failures", status: "passed", fullName: "A reports no failures" }
            ]
          },
          { name: path.join(directory, "b.spec.ts"), status: "passed", assertionResults: [{ ancestorTitles: ["B"], title: "works", status: "passed", fullName: "B works" }] }
        ]
      });
      const runner = new AngularReportRunnerFixture(report, [0, 0]);

      const retrying = await AngularProjectTests.create(repository, runner).testAsync([], true);
      const single = await AngularProjectTests.create(repository, runner).testAsync([], false);

      assert.deepEqual(retrying.retried, [new RetriedTest("shell/a.spec.ts", "A retries", "Error: first")]);
      assert.deepEqual(single.collected, ["b.spec.ts", "shell/a.spec.ts"]);
      assert.deepEqual([single.result?.passed, single.result?.failed], [3, 2]);
      assert.deepEqual([runner.environments[0]?.["TEAMRUN_TEST_RETRY"], runner.environments[1]], ["1", undefined]);
      assert.equal(AngularProject.RETRY_VARIABLE, "TEAMRUN_TEST_RETRY");
    });

    test("tests selected by path run through the CLI's include option, without the coverage gate", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      const directory = path.join(repository.directory, "src");
      const report = path.join(repository.directory, "_build", "angular-tests.json");
      const reporting = new AngularReportRunnerFixture(JSON.stringify({ testResults: [{ name: path.join(directory, "a.spec.ts"), status: "passed", assertionResults: [] }] }), [0]);

      const run = await AngularProjectTests.create(repository, reporting).testAsync(["a.spec.ts", "shell/b.spec.ts"], false);

      assert.deepEqual(run.collected, ["a.spec.ts"]);
      assert.deepEqual(reporting.runs, [[
        process.execPath, directory, path.join(directory, "node_modules", "@angular", "cli", "bin", "ng.js"), "test", "--reporters=default", "--reporters=json", "--output-file", report,
        "--no-coverage", "--include", "a.spec.ts", "--include", "shell/b.spec.ts"
      ]]);
    });

    test("the tests start without the runner's pre-bundled dependencies, since the package check may have reinstalled TeamRun's packages since the build", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      await repository.writeAsync({ "src/node_modules/.vite/vitest/0123abcd/deps/@noldova_teamrun-shell-protocol.js": "export class EarlierBuild {}\n" });
      let isCachePresent: boolean | null = null;
      const runner = new class extends ProcessRunnerFixture {
        public override runLoggedAsync(command: string, commandArguments: readonly string[], directory: string, log: string): Promise<number | null> {
          isCachePresent = existsSync(path.join(directory, "node_modules", ".vite"));
          return super.runLoggedAsync(command, commandArguments, directory, log, new TextOutputFixture(), new TextOutputFixture());
        }
      }();

      await AngularProjectTests.create(repository, runner).testAsync([], false);

      assert.equal(isCachePresent, false);
    });

    test("a report that is not JSON or lists no test files is refused", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);

      await assert.rejects(AngularProjectTests.create(repository, new AngularReportRunnerFixture("{", [0])).testAsync([], false), AngularProjectTests.notJson("_build/angular-tests.json"));
      await assert.rejects(AngularProjectTests.create(repository, new AngularReportRunnerFixture("{\"testResults\":[{}]}", [0])).testAsync([], false),
        new ProcessException("The Angular test report _build/angular-tests.json lists no test files."));
    });

    test("the spec files are those the test target's include patterns match under src/", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      await repository.writeAsync({
        "src/angular.json": JSON.stringify({ projects: { tools: {}, teamrun: { architect: { test: { options: { include: ["shell/*/tests/**/*.spec.ts", "modules/*/tests/*.spec.ts"] } } } } } }),
        "src/shell/ui/tests/b.spec.ts": "", "src/shell/ui/tests/deep/a.spec.ts": "", "src/shell/ui/tests/helper.ts": "", "src/modules/notes/tests/n.spec.ts": "", "src/other/x.spec.ts": ""
      });

      assert.deepEqual(await AngularProjectTests.create(repository, new ProcessRunnerFixture()).specFilesAsync(),
        ["modules/notes/tests/n.spec.ts", "shell/ui/tests/b.spec.ts", "shell/ui/tests/deep/a.spec.ts"]);
    });

    test("a workspace without include patterns for its test target, with exclude patterns, or that is not JSON, is refused", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      const project = AngularProjectTests.create(repository, new ProcessRunnerFixture());
      const refused = new ProcessException("src/angular.json names no spec files for its test target.");

      await assert.rejects(project.specFilesAsync(), refused);
      for (const include of [[], [1], "shell"]) {
        await repository.writeAsync({ "src/angular.json": JSON.stringify({ projects: { teamrun: { architect: { test: { options: { include } } } } } }) });
        await assert.rejects(project.specFilesAsync(), refused);
      }
      await repository.writeAsync({ "src/angular.json": JSON.stringify({ projects: { teamrun: { architect: { test: { options: { include: ["**/*.spec.ts"], exclude: ["old/**"] } } } } } }) });
      await assert.rejects(project.specFilesAsync(),
        new ProcessException("src/angular.json excludes files from its test target, and the check of the spec files run does not apply exclusions."));
      await repository.writeAsync({ "src/angular.json": JSON.stringify({ projects: [] }) });
      await assert.rejects(project.specFilesAsync(), refused);
      await repository.writeAsync({ "src/angular.json": "{" });
      await assert.rejects(project.specFilesAsync(), AngularProjectTests.notJson("src/angular.json"));
    });

    test("the window is built with the Angular CLI in src/, and a failed build stops with its exit code", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      const passing = new ProcessRunnerFixture([0, 0]);
      const output = new TextOutputFixture();
      const variant = path.join(repository.directory, "_build", "variants", "without-clock", "window");

      await AngularProjectTests.create(repository, passing).buildAsync(output, null);
      await AngularProjectTests.create(repository, passing).buildAsync(new TextOutputFixture(), variant);

      const directory = path.join(repository.directory, "src");
      const cli = path.join(directory, "node_modules", "@angular", "cli", "bin", "ng.js");
      assert.deepEqual(passing.runs, [[process.execPath, directory, cli, "build"], [process.execPath, directory, cli, "build", "--output-path", variant]]);
      assert.equal(output.text, "Building the window...\n");
      await assert.rejects(
        AngularProjectTests.create(repository, new ProcessRunnerFixture([3])).buildAsync(new TextOutputFixture(), null),
        new ProcessException("Building the window failed with exit code 3."));
    });

    test("a window is checked for a text it must not contain, in the build folder or the given one, and a tree without the project has nothing to check", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      const empty = await RepositoryFixture.createAsync();
      t.after(() => empty.disposeAsync());
      await repository.writeAsync({
        "_build/window/browser/main.js": "const a = 1;\n",
        "_build/window/browser/styles/page.css": ".tr-page {}\n",
        "_build/variants/window/main.js": "const b = \"tr-gallery-scope-frame\";\n"
      });
      const project = AngularProjectTests.create(repository, new ProcessRunnerFixture());

      await project.verifyWithoutAsync(null, ["tr-gallery-forms", "tr-gallery-scope-frame"]);
      await assert.rejects(
        project.verifyWithoutAsync(path.join(repository.directory, "_build", "variants", "window"), ["tr-gallery-forms", "tr-gallery-scope-frame"]),
        new ProcessException("The window built in _build/variants/window contains \"tr-gallery-scope-frame\" in main.js."));
      await AngularProjectTests.create(empty, new ProcessRunnerFixture()).verifyWithoutAsync(null, ["tr-gallery-scope-frame"]);
    });

    test("a window folder with no files, or none at all, cannot pass the check for a text it must not contain", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      await mkdir(path.join(repository.directory, "_build", "variants", "window", "browser"), { recursive: true });
      const project = AngularProjectTests.create(repository, new ProcessRunnerFixture());

      await assert.rejects(
        project.verifyWithoutAsync(path.join(repository.directory, "_build", "variants", "window"), ["tr-gallery-scope-frame"]),
        new ProcessException("The window built in _build/variants/window has no files to check."));
      await assert.rejects(project.verifyWithoutAsync(null, ["tr-gallery-scope-frame"]), new ProcessException("The window built in _build/window has no files to check."));
    });

    test("a tree without the Angular project has no window to build", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const runner = new ProcessRunnerFixture();
      const output = new TextOutputFixture();

      await AngularProjectTests.create(repository, runner).buildAsync(output, null);

      assert.deepEqual([output.text, runner.runs], ["", []]);
    });

    test("the path aliases of the source project lead to files resolved from src/", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      await repository.writeAsync({ "src/tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "@noldova/teamrun-shell-ui": ["./shell/ui/src/api/index.ts"], "@noldova/x": [] } } }) });
      const project = AngularProjectTests.create(repository, new ProcessRunnerFixture());

      assert.deepEqual(await project.readPathAliasesAsync(), new Map([
        ["@noldova/teamrun-shell-ui", [path.join(repository.directory, "src/shell/ui/src/api/index.ts")]],
        ["@noldova/x", []]
      ]));
      assert.equal(project.projectFile, path.join(repository.directory, "src/tsconfig.json"));
    });

    test("a source project that is missing, is not JSON, or does not map its aliases to lists of files is refused", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      const project = AngularProjectTests.create(repository, new ProcessRunnerFixture());
      const refused = new ProcessException("src/tsconfig.json must map its path aliases to lists of files in compilerOptions.paths.");

      await assert.rejects(project.readPathAliasesAsync(), new ProcessException("The Angular project has no src/tsconfig.json."));
      await repository.writeAsync({ "src/tsconfig.json": "{" });
      await assert.rejects(project.readPathAliasesAsync(), AngularProjectTests.notJson("src/tsconfig.json"));
      for (const paths of [undefined, [], "./index.ts", { "@noldova/x": "./index.ts" }, { "@noldova/x": [1] }]) {
        await repository.writeAsync({ "src/tsconfig.json": JSON.stringify({ compilerOptions: { paths } }) });
        await assert.rejects(project.readPathAliasesAsync(), refused);
      }
    });
  }

  private static pausing(attempt: number): string {
    return `The browser for the Angular tests could not be installed (attempt ${attempt} of 4); trying again in ${MockPausesFixture.PAUSE / 1000} seconds.\n`;
  }

  private static async createProjectAsync(t: { after: (callback: () => Promise<void>) => void }): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({ "src/angular.json": "{}\n", "src/package-lock.json": "{}\n" });
    return repository;
  }

  private static notJson(file: string): { name: string; message: RegExp } {
    return { name: ProcessException.name, message: new RegExp(`^${file.replaceAll(".", "\\.")} could not be read as JSON: \\S.*\\.$`) };
  }

  private static formatRecord(lockfile: string): string {
    return `${process.platform} ${process.arch} ${createHash("sha256").update(lockfile).digest("hex")}\n`;
  }

  private static create(repository: RepositoryFixture, runner: ProcessRunnerFixture): AngularProject {
    return new AngularProject(repository.directory, runner, new NpmCommand(runner, { npm_execpath: AngularProjectTests.NPM }));
  }
}

AngularProjectTests.register();
