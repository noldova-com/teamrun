/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { appendFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import BuildVariant from "../../modules/build-variant.ts";
import ModuleCatalog from "../../modules/module-catalog.ts";
import PackageBuild from "../../packages/package-build.ts";
import PackageException from "../../packages/package.exception.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import PackageTreeFixture from "../fixtures/package-tree.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class PackageBuildTests {
  private static readonly BUILD_TIMEOUT: number = 60_000;
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

      assert.deepEqual(await build.buildAsync(output, BuildVariant.REGULAR), []);
      await build.requireCurrentAsync(BuildVariant.REGULAR);
      assert.equal(output.text, "");
    });

    test("packages build after their dependencies, otherwise in path order, and then their tests; an unchanged tree reuses everything", { timeout: PackageBuildTests.BUILD_TIMEOUT }, async t => {
      const repository = await PackageBuildTests.createAsync(t);
      await PackageTreeFixture.writePackageAsync(repository, "shell-gamma", [], false, false);
      const build = new PackageBuild(repository.directory, new ProcessRunner(), process.env);

      const packages = await build.buildAsync(new TextOutputFixture(), BuildVariant.REGULAR);
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

    test("a changed source rebuilds its package, its dependants and all tests", { timeout: PackageBuildTests.BUILD_TIMEOUT }, async t => {
      const repository = await PackageBuildTests.createAsync(t);
      const build = new PackageBuild(repository.directory, new ProcessRunner(), process.env);
      const first = await PackageBuildTests.buildAsync(build);

      await repository.writeAsync({ "src/foundation/alpha/src/resources.ts": "export default class Resources {\n  public static readonly version: string = \"changed\";\n  public static readonly protocol: string = \"\";\n}\n" });
      const changed = await PackageBuildTests.buildAsync(build);

      assert.deepEqual(first, PackageBuildTests.ALL_BUILT);
      assert.deepEqual(changed, PackageBuildTests.ALL_BUILT);
    });

    test("one application fingerprint is stamped, and any source change rebuilds the packages that stamp it but not unchanged ones", { timeout: PackageBuildTests.BUILD_TIMEOUT }, async t => {
      const repository = await PackageBuildTests.createAsync(t);
      await PackageTreeFixture.writePackageAsync(repository, "shell-gamma", [], false, false);
      await repository.writeAsync({ "src/shell/gamma/src/resources.ts": "export default class Resources {\n  public static readonly build: string = \"__BUILD__\";\n}\n" });
      const build = new PackageBuild(repository.directory, new ProcessRunner(), process.env);
      const stamped = async (): Promise<string> => (await readFile(path.join(repository.directory, "node_modules", "@noldova", "teamrun-shell-gamma", "resources.js"), "utf8")).match(/build = "([0-9a-f]+)";/)?.[1] ?? "";
      await PackageBuildTests.buildAsync(build);
      const first = await stamped();

      await repository.writeAsync({ "src/shell/beta/src/resources.ts": "export default class Resources {\n  public static readonly version: string = \"changed\";\n  public static readonly protocol: string = \"\";\n}\n" });
      const changed = await PackageBuildTests.buildAsync(build);
      await build.requireCurrentAsync(BuildVariant.REGULAR);

      assert.match(first, /^[0-9a-f]{64}$/);
      assert.notEqual(await stamped(), first);
      assert.deepEqual(changed, [
        `${PackageBuildTests.ALPHA}: reused`,
        `${PackageBuildTests.GAMMA}: built`,
        `${PackageBuildTests.BETA}: built`,
        `${PackageBuildTests.ALPHA} tests: compiled`,
        `${PackageBuildTests.BETA} tests: compiled`
      ]);
    });

    test("a changed test recompiles only that package's tests", { timeout: PackageBuildTests.BUILD_TIMEOUT }, async t => {
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

    test("a changed installed package is refused, with everything that depends on it, until the build replaces it", { timeout: PackageBuildTests.BUILD_TIMEOUT }, async t => {
      const repository = await PackageBuildTests.createAsync(t);
      const build = new PackageBuild(repository.directory, new ProcessRunner(), process.env);
      await PackageBuildTests.buildAsync(build);

      await appendFile(path.join(repository.directory, "node_modules", "@noldova", "teamrun-foundation-alpha", "api", "index.js"), "\n");
      await assert.rejects(build.requireCurrentAsync(BuildVariant.REGULAR), PackageBuildTests.ALL_STALE);
      const repaired = await PackageBuildTests.buildAsync(build);
      await build.requireCurrentAsync(BuildVariant.REGULAR);

      assert.deepEqual(repaired, PackageBuildTests.REINSTALLED);
    });

    test("missing installed packages are refused until the build reinstalls them", { timeout: PackageBuildTests.BUILD_TIMEOUT }, async t => {
      const repository = await PackageBuildTests.createAsync(t);
      const build = new PackageBuild(repository.directory, new ProcessRunner(), process.env);
      await PackageBuildTests.buildAsync(build);

      await rm(path.join(repository.directory, "node_modules"), { recursive: true, force: true });
      await assert.rejects(build.requireCurrentAsync(BuildVariant.REGULAR), PackageBuildTests.ALL_STALE);
      const reinstalled = await PackageBuildTests.buildAsync(build);
      await build.requireCurrentAsync(BuildVariant.REGULAR);

      assert.deepEqual(reinstalled, PackageBuildTests.REINSTALLED);
    });

    test("a test build adds fixture modules' packages without making the other packages' tests stale", { timeout: PackageBuildTests.BUILD_TIMEOUT }, async t => {
      const repository = await PackageBuildTests.createAsync(t);
      await PackageTreeFixture.writePackageAsync(repository, "fixture-notes-runtime", ["shell-beta"], false, true, `${ModuleCatalog.FIXTURE_FOLDER}/notes/runtime`);
      const build = new PackageBuild(repository.directory, new ProcessRunner(), process.env);
      const fixture = "@noldova/teamrun-fixture-notes-runtime";

      const regular = await PackageBuildTests.buildAsync(build);
      const tested = new TextOutputFixture();
      const packages = await build.buildAsync(tested, new BuildVariant(true, []));
      await build.requireCurrentAsync(BuildVariant.REGULAR);
      const again = await PackageBuildTests.buildAsync(build);

      assert.deepEqual(regular, [...PackageBuildTests.ALL_BUILT, `${fixture}: type-checked`]);
      assert.deepEqual(packages.map(t => t.name), [PackageBuildTests.ALPHA, PackageBuildTests.BETA, fixture]);
      assert.deepEqual(tested.text.split("\n").filter(t => t.length > 0), [
        `${PackageBuildTests.ALPHA}: reused`,
        `${PackageBuildTests.BETA}: reused`,
        `${fixture}: built`,
        `${PackageBuildTests.ALPHA} tests: reused`,
        `${PackageBuildTests.BETA} tests: reused`
      ]);
      assert.deepEqual(again, [
        `${PackageBuildTests.ALPHA}: reused`,
        `${PackageBuildTests.BETA}: reused`,
        `${PackageBuildTests.ALPHA} tests: reused`,
        `${PackageBuildTests.BETA} tests: reused`,
        `${fixture}: type-checked`
      ]);
    });

    test("the build's module declarations and the packages it hosts decide the fingerprint", { timeout: PackageBuildTests.BUILD_TIMEOUT }, async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await PackageTreeFixture.writeRootAsync(repository);
      await PackageTreeFixture.writePackageAsync(repository, "shell-gamma", [], false, false);
      await PackageTreeFixture.writePackageAsync(repository, "fixture-notes-runtime", [], false, true, `${ModuleCatalog.FIXTURE_FOLDER}/notes/runtime`);
      const root = JSON.parse(await readFile(path.join(repository.directory, "package.json"), "utf8"));
      const declare = (id: string, displayName: string): string => JSON.stringify({ id, version: "0.0.1", displayName, description: "Used by the tests.", parts: [], dependencies: [], contributes: {} });
      await repository.writeAsync({
        "package.json": `${JSON.stringify({ ...root, teamrun: { ...root.teamrun, modules: ["tasks"] } }, null, 2)}\n`,
        "src/modules/tasks/module.json": declare("tasks", "Tasks"),
        [`${ModuleCatalog.FIXTURE_FOLDER}/notes/module.json`]: declare("notes", "Notes"),
        "src/shell/gamma/src/resources.ts": "export default class Resources {\n  public static readonly build: string = \"__BUILD__\";\n}\n"
      });
      const build = new PackageBuild(repository.directory, new ProcessRunner(), process.env);
      const stamped = async (variant: BuildVariant): Promise<string> => {
        await build.buildAsync(new TextOutputFixture(), variant);
        await build.requireCurrentAsync(variant);
        return await readFile(path.join(repository.directory, "node_modules", "@noldova", "teamrun-shell-gamma", "resources.js"), "utf8");
      };

      const regular = await stamped(BuildVariant.REGULAR);
      const tested = await stamped(new BuildVariant(true, ["notes"]));
      await repository.writeAsync({ "src/modules/tasks/module.json": declare("tasks", "Task list") });
      const renamed = await stamped(BuildVariant.REGULAR);

      assert.equal(new Set([regular, tested, renamed]).size, 3);
    });

    test("a module's part package is packed and installed at the module's version, and raising it rebuilds that package and recompiles the tests",{ timeout: PackageBuildTests.BUILD_TIMEOUT }, async t => {
      const repository = await PackageBuildTests.createAsync(t);
      const tasks = "@noldova/teamrun-modules-tasks-runtime";
      await PackageTreeFixture.writePackageAsync(repository, "modules-tasks-runtime", ["shell-beta"], false, false, "src/modules/tasks/runtime");
      const declare = (version: string): Record<string, string> => ({
        "src/modules/tasks/module.json": JSON.stringify({ id: "tasks", version, displayName: "Tasks", description: "Used by the tests.", parts: ["runtime"], dependencies: [], contributes: {} })
      });
      await repository.writeAsync(declare("0.3.0"));
      const build = new PackageBuild(repository.directory, new ProcessRunner(), process.env);
      const installed = async (): Promise<Readonly<Record<string, unknown>>> =>
        JSON.parse(await readFile(path.join(repository.directory, "node_modules", "@noldova", "teamrun-modules-tasks-runtime", "package.json"), "utf8")) as Readonly<Record<string, unknown>>;
      await PackageBuildTests.buildAsync(build);
      const first = await installed();

      await repository.writeAsync(declare("0.4.0"));
      const raised = await PackageBuildTests.buildAsync(build);
      await build.requireCurrentAsync(BuildVariant.REGULAR);

      assert.deepEqual([first["version"], first["dependencies"]], ["0.3.0", { [PackageBuildTests.BETA]: "0.0.7" }]);
      assert.equal((await installed())["version"], "0.4.0");
      assert.ok(existsSync(path.join(repository.directory, "_build", "archives", "noldova-teamrun-modules-tasks-runtime-0.4.0.tgz")));
      assert.deepEqual(raised, [
        `${PackageBuildTests.ALPHA}: reused`,
        `${PackageBuildTests.BETA}: reused`,
        `${tasks}: built`,
        `${PackageBuildTests.ALPHA} tests: compiled`,
        `${PackageBuildTests.BETA} tests: compiled`
      ]);
    });

    test("a regular build type-checks the fixture packages it does not build, and refuses one with a type error", { timeout: PackageBuildTests.BUILD_TIMEOUT }, async t => {
      const repository = await PackageBuildTests.createAsync(t);
      const directory = `${ModuleCatalog.FIXTURE_FOLDER}/notes/runtime`;
      await PackageTreeFixture.writePackageAsync(repository, "fixture-notes-runtime", [], false, true, directory);
      await repository.writeAsync({ [`${directory}/src/api/index.ts`]: "export const count: number = \"many\";\n" });
      const build = new PackageBuild(repository.directory, new ProcessRunner(), process.env);

      await assert.rejects(build.buildAsync(new TextOutputFixture(), BuildVariant.REGULAR), new RegExp(`^PackageException: Type-checking ${directory}/src failed with exit code \\d+:`));
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
    await build.buildAsync(output, BuildVariant.REGULAR);
    return output.text.split("\n").filter(t => t.length > 0);
  }
}

PackageBuildTests.register();
