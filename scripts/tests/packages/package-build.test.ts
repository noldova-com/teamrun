/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { appendFile, rm } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import PackageBuild from "../../packages/package-build.ts";
import PackageException from "../../packages/package.exception.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import PackageTreeFixture from "../fixtures/package-tree.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class PackageBuildTests {
  private static readonly ALPHA: string = "@noldova/teamrun-foundation-alpha";
  private static readonly BETA: string = "@noldova/teamrun-shell-beta";
  private static readonly GAMMA: string = "@noldova/teamrun-shell-gamma";
  private static readonly ALL_STALE: PackageException = new PackageException(
    `The built artifacts of ${PackageBuildTests.ALPHA}, ${PackageBuildTests.BETA}, ${PackageBuildTests.ALPHA} tests, ${PackageBuildTests.BETA} tests are missing or stale; run npm run build.`);
  private static readonly ALL_BUILT: readonly string[] = [
    `${PackageBuildTests.ALPHA}: built`,
    `${PackageBuildTests.BETA}: built`,
    `${PackageBuildTests.ALPHA} tests: compiled`,
    `${PackageBuildTests.BETA} tests: compiled`
  ];
  private static readonly REINSTALLED: readonly string[] = [
    `${PackageBuildTests.ALPHA}: built`,
    `${PackageBuildTests.BETA}: reused`,
    `${PackageBuildTests.ALPHA} tests: reused`,
    `${PackageBuildTests.BETA} tests: reused`
  ];

  public static register(): void {
    test("a tree without packages builds nothing and is current", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const build = new PackageBuild(repository.directory, new ProcessRunner(), process.env);
      const output = new TextOutputFixture();

      assert.deepEqual(await build.buildAsync(output), []);
      await build.requireCurrentAsync();
      assert.equal(output.text, "");
    });

    test("packages build after their dependencies, otherwise in path order, and then their tests; an unchanged tree reuses everything", async t => {
      const repository = await PackageBuildTests.createAsync(t);
      await PackageTreeFixture.writePackageAsync(repository, "shell-gamma", [], false, false);
      const build = new PackageBuild(repository.directory, new ProcessRunner(), process.env);

      const packages = await build.buildAsync(new TextOutputFixture());
      const output = await PackageBuildTests.buildAsync(build);

      assert.deepEqual(packages.map(t => t.name), [PackageBuildTests.ALPHA, PackageBuildTests.GAMMA, PackageBuildTests.BETA]);
      assert.deepEqual(output, [
        `${PackageBuildTests.ALPHA}: reused`,
        `${PackageBuildTests.GAMMA}: reused`,
        `${PackageBuildTests.BETA}: reused`,
        `${PackageBuildTests.ALPHA} tests: reused`,
        `${PackageBuildTests.BETA} tests: reused`
      ]);
    });

    test("a changed source rebuilds its package, its dependants and all tests", async t => {
      const repository = await PackageBuildTests.createAsync(t);
      const build = new PackageBuild(repository.directory, new ProcessRunner(), process.env);
      const first = await PackageBuildTests.buildAsync(build);

      await repository.writeAsync({ "src/foundation/alpha/src/resources.ts": "export default class Resources {\n  public static readonly version: string = \"changed\";\n  public static readonly protocol: string = \"\";\n}\n" });
      const changed = await PackageBuildTests.buildAsync(build);

      assert.deepEqual(first, PackageBuildTests.ALL_BUILT);
      assert.deepEqual(changed, PackageBuildTests.ALL_BUILT);
    });

    test("a changed test recompiles only that package's tests", async t => {
      const repository = await PackageBuildTests.createAsync(t);
      const build = new PackageBuild(repository.directory, new ProcessRunner(), process.env);
      await PackageBuildTests.buildAsync(build);

      await repository.writeAsync({ "src/shell/beta/tests/api/index.test.ts": "export const changed: boolean = true;\n" });
      const changed = await PackageBuildTests.buildAsync(build);

      assert.deepEqual(changed, [
        `${PackageBuildTests.ALPHA}: reused`,
        `${PackageBuildTests.BETA}: reused`,
        `${PackageBuildTests.ALPHA} tests: reused`,
        `${PackageBuildTests.BETA} tests: compiled`
      ]);
    });

    test("a changed installed package is refused, with everything that depends on it, until the build replaces it", async t => {
      const repository = await PackageBuildTests.createAsync(t);
      const build = new PackageBuild(repository.directory, new ProcessRunner(), process.env);
      await PackageBuildTests.buildAsync(build);

      await appendFile(path.join(repository.directory, "node_modules", "@noldova", "teamrun-foundation-alpha", "api", "index.js"), "\n");
      await assert.rejects(build.requireCurrentAsync(), PackageBuildTests.ALL_STALE);
      const repaired = await PackageBuildTests.buildAsync(build);
      await build.requireCurrentAsync();

      assert.deepEqual(repaired, PackageBuildTests.REINSTALLED);
    });

    test("missing installed packages are refused until the build reinstalls them", async t => {
      const repository = await PackageBuildTests.createAsync(t);
      const build = new PackageBuild(repository.directory, new ProcessRunner(), process.env);
      await PackageBuildTests.buildAsync(build);

      await rm(path.join(repository.directory, "node_modules"), { recursive: true, force: true });
      await assert.rejects(build.requireCurrentAsync(), PackageBuildTests.ALL_STALE);
      const reinstalled = await PackageBuildTests.buildAsync(build);
      await build.requireCurrentAsync();

      assert.deepEqual(reinstalled, PackageBuildTests.REINSTALLED);
    });
  }

  private static async createAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await PackageTreeFixture.writeRootAsync(repository);
    await PackageTreeFixture.writePackageAsync(repository, "foundation-alpha", []);
    await PackageTreeFixture.writePackageAsync(repository, "shell-beta", ["foundation-alpha"]);
    return repository;
  }

  private static async buildAsync(build: PackageBuild): Promise<readonly string[]> {
    const output = new TextOutputFixture();
    await build.buildAsync(output);
    return output.text.split("\n").filter(t => t.length > 0);
  }
}

PackageBuildTests.register();
