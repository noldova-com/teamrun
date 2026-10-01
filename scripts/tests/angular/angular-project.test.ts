/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { utimes } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import AngularProject from "../../angular/angular-project.ts";
import ProcessResult from "../../processes/process-result.ts";
import ProcessException from "../../processes/process.exception.ts";
import NpmCommand from "../../toolchain/npm-command.ts";
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
    });

    test("an installed project is reinstalled only when its lockfile is newer than the installation", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      await repository.writeAsync({ "src/node_modules/.package-lock.json": "{}\n", "src/node_modules/@angular/cli/bin/ng.js": "" });
      const lockfile = path.join(repository.directory, "src", "package-lock.json");
      const installed = path.join(repository.directory, "src", "node_modules", ".package-lock.json");
      await utimes(lockfile, new Date(2026, 0, 1), new Date(2026, 0, 1));
      await utimes(installed, new Date(2026, 0, 2), new Date(2026, 0, 2));
      const current = new ProcessRunnerFixture();
      await AngularProjectTests.create(repository, current).prepareAsync(new TextOutputFixture());

      await utimes(lockfile, new Date(2026, 0, 3), new Date(2026, 0, 3));
      const changed = new ProcessRunnerFixture([], [new ProcessResult(0, "", "")]);
      await AngularProjectTests.create(repository, changed).prepareAsync(new TextOutputFixture());

      assert.deepEqual([current.captured.length, current.runs.length], [0, 1]);
      assert.deepEqual([changed.captured.length, changed.runs.length], [1, 1]);
    });

    test("a project without its CLI is reinstalled", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      await repository.writeAsync({ "src/node_modules/.package-lock.json": "{}\n" });
      const runner = new ProcessRunnerFixture([], [new ProcessResult(0, "", "")]);

      await AngularProjectTests.create(repository, runner).prepareAsync(new TextOutputFixture());

      assert.equal(runner.captured.length, 1);
    });

    test("a failed install or browser install stops the preparation with the reason", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);

      await assert.rejects(
        AngularProjectTests.create(repository, new ProcessRunnerFixture([], [new ProcessResult(1, "", "npm ERR! lockfile out of date\n")])).prepareAsync(new TextOutputFixture()),
        new ProcessException("\"npm ci\" in src/ failed with exit code 1: npm ERR! lockfile out of date"));
      await assert.rejects(
        AngularProjectTests.create(repository, new ProcessRunnerFixture([2], [new ProcessResult(0, "", "")])).prepareAsync(new TextOutputFixture()),
        new ProcessException("Installing the browser for the Angular tests failed with exit code 2."));
    });

    test("the tests run the Angular CLI in src/ and report its result", async t => {
      const repository = await AngularProjectTests.createProjectAsync(t);
      const passing = new ProcessRunnerFixture([0]);
      const failing = new ProcessRunnerFixture([1]);

      assert.equal(await AngularProjectTests.create(repository, passing).testAsync(), true);
      assert.equal(await AngularProjectTests.create(repository, failing).testAsync(), false);

      const directory = path.join(repository.directory, "src");
      assert.deepEqual(passing.runs, [[process.execPath, directory, path.join(directory, "node_modules", "@angular", "cli", "bin", "ng.js"), "test"]]);
    });
  }

  private static async createProjectAsync(t: { after: (callback: () => Promise<void>) => void }): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({ "src/angular.json": "{}\n", "src/package-lock.json": "{}\n" });
    return repository;
  }

  private static create(repository: RepositoryFixture, runner: ProcessRunnerFixture): AngularProject {
    return new AngularProject(repository.directory, runner, new NpmCommand(runner, { npm_execpath: AngularProjectTests.NPM }));
  }
}

AngularProjectTests.register();
