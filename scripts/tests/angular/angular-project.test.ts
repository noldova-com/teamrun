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
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import AngularProject from "../../angular/angular-project.ts";
import ProcessResult from "../../processes/process-result.ts";
import ProcessException from "../../processes/process.exception.ts";
import NpmCommand from "../../toolchain/npm-command.ts";
import AngularReportRunnerFixture from "../fixtures/angular-report-runner.fixture.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class AngularProjectTests {
  private static readonly NPM: string = "/tools/npm/bin/npm-cli.js";

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
      const runner = new ProcessRunnerFixture([0], [new ProcessResult(0, "added 1 package", "")]);
      const output = new TextOutputFixture();

      await AngularProjectTests.create(repository, runner).prepareAsync(output);

      const directory = path.join(repository.directory, "src");
      assert.equal(existsSync(path.join(directory, "node_modules", "@noldova")), false);
      assert.deepEqual(runner.captured, [[process.execPath, directory, AngularProjectTests.NPM, "ci", "--no-audit", "--no-fund"]]);
      assert.deepEqual(runner.runs, [[process.execPath, directory, path.join(directory, "node_modules", "playwright", "cli.js"), "install", "--only-shell", "chromium"]]);
      assert.equal(output.text, "Installing the Angular project in src/...\nInstalling the browser for the Angular tests...\n");
      assert.equal(await readFile(path.join(directory, "node_modules", ".teamrun-install"), "utf8"), AngularProjectTests.formatRecord("{}\n"));
    });

    test("an installed project is reinstalled only when its lockfile, platform or CPU differ from the recorded install", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      await repository.writeAsync({ "src/node_modules/.teamrun-install": AngularProjectTests.formatRecord("{}\n"), "src/node_modules/@angular/cli/bin/ng.js": "" });
      const current = new ProcessRunnerFixture();
      await AngularProjectTests.create(repository, current).prepareAsync(new TextOutputFixture());

      await repository.writeAsync({ "src/package-lock.json": "{ \"lockfileVersion\": 3 }\n" });
      const changed = new ProcessRunnerFixture([], [new ProcessResult(0, "", "")]);
      await AngularProjectTests.create(repository, changed).prepareAsync(new TextOutputFixture());
      const afterChange = await readFile(path.join(repository.directory, "src", "node_modules", ".teamrun-install"), "utf8");

      await repository.writeAsync({ "src/node_modules/.teamrun-install": afterChange.replace(process.arch, "other-cpu") });
      const otherCpu = new ProcessRunnerFixture([], [new ProcessResult(0, "", "")]);
      await AngularProjectTests.create(repository, otherCpu).prepareAsync(new TextOutputFixture());

      assert.deepEqual([current.captured.length, current.runs.length], [0, 1]);
      assert.deepEqual([changed.captured.length, changed.runs.length], [1, 1]);
      assert.equal(afterChange, AngularProjectTests.formatRecord("{ \"lockfileVersion\": 3 }\n"));
      assert.equal(otherCpu.captured.length, 1);
    });

    test("preparing an installed project removes the test runner's pre-bundled dependencies, so no copy of an earlier build of TeamRun's packages survives", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      const stale = "src/node_modules/.vite/vitest/0123abcd/deps/@noldova_teamrun-shell-protocol.js";
      await repository.writeAsync({
        "src/node_modules/.teamrun-install": AngularProjectTests.formatRecord("{}\n"),
        "src/node_modules/@angular/cli/bin/ng.js": "",
        [stale]: "export class EarlierBuild {}\n"
      });
      const runner = new ProcessRunnerFixture();

      await AngularProjectTests.create(repository, runner).prepareAsync(new TextOutputFixture());

      assert.equal(runner.captured.length, 0);
      assert.equal(existsSync(path.join(repository.directory, "src", "node_modules", ".vite")), false);
      assert.equal(existsSync(path.join(repository.directory, "src", "node_modules", "@angular", "cli", "bin", "ng.js")), true);
    });

    test("a project without its CLI is reinstalled", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      await repository.writeAsync({ "src/node_modules/.teamrun-install": AngularProjectTests.formatRecord("{}\n") });
      const runner = new ProcessRunnerFixture([], [new ProcessResult(0, "", "")]);

      await AngularProjectTests.create(repository, runner).prepareAsync(new TextOutputFixture());

      assert.equal(runner.captured.length, 1);
    });

    test("a failed install or browser install stops the preparation with the reason", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      await repository.writeAsync({ "src/node_modules/.package-lock.json": "{}\n" });

      await assert.rejects(
        AngularProjectTests.create(repository, new ProcessRunnerFixture([], [new ProcessResult(1, "", "npm ERR! lockfile out of date\n")])).prepareAsync(new TextOutputFixture()),
        new ProcessException("\"npm ci\" in src/ failed with exit code 1: npm ERR! lockfile out of date"));
      await assert.rejects(
        AngularProjectTests.create(repository, new ProcessRunnerFixture([2], [new ProcessResult(0, "", "")])).prepareAsync(new TextOutputFixture()),
        new ProcessException("Installing the browser for the Angular tests failed with exit code 2."));
    });

    test("the tests run the Angular CLI in src/ with a JSON report and a log of their output, and give its result and the spec files it ran", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      const directory = path.join(repository.directory, "src");
      const report = path.join(repository.directory, "_build", "angular-tests.json");
      const reporting = new AngularReportRunnerFixture(JSON.stringify({ testResults: [{ name: path.join(directory, "shell", "b.spec.ts") }, { name: path.join(directory, "a.spec.ts") }] }), [0]);
      await repository.writeAsync({ "_build/angular-tests.json": "stale" });

      const run = await AngularProjectTests.create(repository, reporting).testAsync();
      const silent = await AngularProjectTests.create(repository, new ProcessRunnerFixture([1])).testAsync();

      assert.deepEqual([run.isSuccessful, run.collected], [true, ["a.spec.ts", "shell/b.spec.ts"]]);
      assert.deepEqual([silent.isSuccessful, silent.exitCode, silent.collected], [false, 1, null]);
      assert.deepEqual(reporting.runs, [[process.execPath, directory, path.join(directory, "node_modules", "@angular", "cli", "bin", "ng.js"), "test", "--reporters=default", "--reporters=json", "--output-file", report]]);
      assert.deepEqual(reporting.logs, [path.join(repository.directory, "_build", "angular-tests.log")]);
      assert.equal(AngularProject.LOG_FILE, "_build/angular-tests.log");
    });

    test("tests selected by path run through the CLI's include option, without the coverage gate", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      const directory = path.join(repository.directory, "src");
      const report = path.join(repository.directory, "_build", "angular-tests.json");
      const reporting = new AngularReportRunnerFixture(JSON.stringify({ testResults: [{ name: path.join(directory, "a.spec.ts") }] }), [0]);

      const run = await AngularProjectTests.create(repository, reporting).testAsync(["a.spec.ts", "shell/b.spec.ts"]);

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
          return super.runLoggedAsync(command, commandArguments, directory, log);
        }
      }();

      await AngularProjectTests.create(repository, runner).testAsync();

      assert.equal(isCachePresent, false);
    });

    test("a report that is not JSON or lists no test files is refused", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);

      await assert.rejects(AngularProjectTests.create(repository, new AngularReportRunnerFixture("{", [0])).testAsync(), new ProcessException("angular-tests.json could not be read as JSON."));
      await assert.rejects(AngularProjectTests.create(repository, new AngularReportRunnerFixture("{\"testResults\":[{}]}", [0])).testAsync(),
        new ProcessException(`The Angular test report ${path.join("_build", "angular-tests.json")} lists no test files.`));
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
      await assert.rejects(project.specFilesAsync(), new ProcessException("angular.json could not be read as JSON."));
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
  }

  private static async createProjectAsync(t: { after: (callback: () => Promise<void>) => void }): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({ "src/angular.json": "{}\n", "src/package-lock.json": "{}\n" });
    return repository;
  }

  private static formatRecord(lockfile: string): string {
    return `${process.platform} ${process.arch} ${createHash("sha256").update(lockfile).digest("hex")}\n`;
  }

  private static create(repository: RepositoryFixture, runner: ProcessRunnerFixture): AngularProject {
    return new AngularProject(repository.directory, runner, new NpmCommand(runner, { npm_execpath: AngularProjectTests.NPM }));
  }
}

AngularProjectTests.register();
