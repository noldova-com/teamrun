/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import PackageTestCheck from "../../checks/package-test-check.ts";
import PackageException from "../../packages/package.exception.ts";
import FailingProcessRunnerFixture from "../fixtures/failing-process-runner.fixture.ts";
import PackageBuildFixture from "../fixtures/package-build.fixture.ts";
import PackageTreeFixture from "../fixtures/package-tree.fixture.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class PackageTestCheckTests {
  public static register(): void {
    test("a tree without tested packages passes without running anything", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, false);
      const runner = new ProcessRunnerFixture();
      const output = new TextOutputFixture();
      const check = new PackageTestCheck(repository.directory, new PackageBuildFixture(repository.directory), runner, {});

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "No package has tests.\n");
      assert.equal(check.title, "Package tests");
      assert.equal(runner.runs.length, 0);
    });

    test("the test framework runs every tested package's compiled tests with all tests selected", async t => {
      const repository = await PackageTestCheckTests.createRepositoryAsync(t, true);
      const runner = new ProcessRunnerFixture([0, 1]);
      const check = new PackageTestCheck(repository.directory, new PackageBuildFixture(repository.directory), runner, { KEPT: "yes" });

      assert.equal(await check.runAsync(new TextOutputFixture()), true);
      assert.equal(await check.runAsync(new TextOutputFixture()), false);
      const entry = path.join(repository.directory, "node_modules", "@noldova", "teamrun-foundation-testing", "services", "execution", "test-run-entry.js");
      assert.deepEqual(runner.runs[0], [
        process.execPath,
        repository.directory,
        "--enable-source-maps",
        entry,
        "@noldova/teamrun-foundation-testing",
        path.join(repository.directory, "_build", "tests", "foundation-testing"),
        "@noldova/teamrun-foundation-alpha",
        path.join(repository.directory, "_build", "tests", "foundation-alpha")
      ]);
      assert.deepEqual(runner.environments[0], { KEPT: "yes", TEAMRUN_TEST_FILTERS: "[]" });
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
