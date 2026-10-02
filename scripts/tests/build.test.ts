/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import AngularProject from "../angular/angular-project.ts";
import Build from "../build.ts";
import ModuleArtifacts from "../modules/module-artifacts.ts";
import ModuleCatalog from "../modules/module-catalog.ts";
import PackageBuild from "../packages/package-build.ts";
import ProcessRunner from "../processes/process-runner.ts";
import NpmCommand from "../toolchain/npm-command.ts";
import PackageTreeFixture from "./fixtures/package-tree.fixture.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class BuildTests {
  private static readonly BUILD_TIMEOUT: number = 60_000;
  private static readonly ROOT_MANIFEST: string = JSON.stringify({ teamrun: { modules: [] } });
  private static readonly USAGE: string = "Usage: npm run build [-- --test [--without <module id>]...]\n";

  public static register(): void {
    test("a tree without packages builds nothing and succeeds", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "src/modules/checkpoints/README.md": "# Checkpoints\n", "package.json": BuildTests.ROOT_MANIFEST });
      const output = new TextOutputFixture();

      assert.equal(await BuildTests.create(repository.directory, output, process.env).runAsync([]), 0);
      assert.equal(output.text, "No packages under src/; there is nothing to build.\nModules in the build: 0.\nNo Angular project under src/; there is nothing to prepare.\n");
    });

    test("packages are built and installed, and the build says how many", { timeout: BuildTests.BUILD_TIMEOUT }, async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await PackageTreeFixture.writeRootAsync(repository);
      await PackageTreeFixture.writePackageAsync(repository, "foundation-alpha", [], false);
      const output = new TextOutputFixture();

      assert.equal(await BuildTests.create(repository.directory, output, process.env).runAsync([]), 0);
      assert.equal(
        output.text,
        "@noldova/teamrun-foundation-alpha: built\nPackages built and installed: 1.\nModules in the build: 0.\nNo Angular project under src/; there is nothing to prepare.\n");
    });

    test("a test build adds the fixture modules, leaves out the named ones and writes the module artifacts", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "package.json": JSON.stringify({ teamrun: { modules: ["notes"] } }),
        "src/modules/notes/module.json": JSON.stringify({ id: "notes", displayName: "Notes", parts: ["window"], dependencies: [], contributes: { views: ["notes.list"] } }),
        "src/modules/notes/window/src/api/index.ts": "export {};\n",
        [`${ModuleCatalog.FIXTURE_FOLDER}/clock/module.json`]: JSON.stringify({ id: "clock", displayName: "Clock", parts: ["window"], dependencies: ["notes"], contributes: {} }),
        [`${ModuleCatalog.FIXTURE_FOLDER}/clock/window/src/api/index.ts`]: "export {};\n"
      });
      const artifacts = new ModuleArtifacts(repository.directory);
      const regular = new TextOutputFixture();
      const tested = new TextOutputFixture();
      const without = new TextOutputFixture();
      const unknown = new TextOutputFixture();

      assert.equal(await BuildTests.create(repository.directory, regular, process.env).runAsync([]), 0);
      const regularParts = await readFile(artifacts.windowPartsFile, "utf8");
      assert.equal(await BuildTests.create(repository.directory, tested, process.env).runAsync(["--test"]), 0);
      const testedParts = await readFile(artifacts.windowPartsFile, "utf8");
      const testedDeclarations = await readFile(artifacts.declarationsFile, "utf8");
      assert.equal(await BuildTests.create(repository.directory, without, process.env).runAsync(["--test", "--without", "clock"]), 0);
      assert.equal(await BuildTests.create(repository.directory, unknown, process.env).runAsync(["--test", "--without", "weather"]), 1);

      assert.match(regular.text, /Modules in the build: 1\./);
      assert.match(tested.text, /Modules in the build: 2\./);
      assert.match(without.text, /Modules in the build: 1\./);
      assert.equal(unknown.text, "The build has no module weather to leave out.\n");
      assert.match(regularParts, /\[\n {2}\(\) => import\("\.\.\/modules\/notes\/window\/src\/api\/index"\)\n\];\n$/);
      assert.match(testedParts, /import\("\.\.\/shell\/desktop\/tests\/e2e\/fixtures\/modules\/clock\/window\/src\/api\/index"\)/);
      assert.match(testedDeclarations, /"id": "notes"[\s\S]*"id": "clock"/);
    });

    test("invalid packages and a missing npm fail with the reason, and other errors are not hidden", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await PackageTreeFixture.writeRootAsync(repository);
      await repository.writeAsync({ "src/shell/ui/package.json": "{ \"name\": \"@noldova/teamrun-ui\", \"version\": \"__VERSION__\" }\n" });
      const invalid = new TextOutputFixture();
      assert.equal(await BuildTests.create(repository.directory, invalid, process.env).runAsync([]), 1);

      await rm(path.join(repository.directory, "src", "shell"), { recursive: true });
      await PackageTreeFixture.writePackageAsync(repository, "foundation-alpha", [], false);
      const withoutNpm = new TextOutputFixture();
      assert.equal(await BuildTests.create(repository.directory, withoutNpm, {}).runAsync([]), 1);

      await rm(path.join(repository.directory, "package-lock.json"));
      await assert.rejects(BuildTests.create(repository.directory, new TextOutputFixture(), process.env).runAsync([]), /ENOENT/);

      assert.equal(invalid.text, "src/shell/ui/package.json must be named \"@noldova/teamrun-shell-ui\", the package's path below src/ joined with hyphens.\n");
      assert.equal(withoutNpm.text, "npm_execpath is not set; run this through npm, such as npm run build or npm test.\n");
    });

    test("an unreadable module list or module declaration fails the build with the reason", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const missing = new TextOutputFixture();
      const invalid = new TextOutputFixture();

      assert.equal(await BuildTests.create(repository.directory, missing, process.env).runAsync([]), 1);
      await repository.writeAsync({ "package.json": JSON.stringify({ teamrun: { modules: ["notes"] } }) });
      assert.equal(await BuildTests.create(repository.directory, invalid, process.env).runAsync([]), 1);

      assert.equal(missing.text, "The root package.json must list the build's modules once each in teamrun.modules.\n");
      assert.equal(invalid.text, "The build lists the module notes, but src/modules/notes has no module.json.\n");
    });

    test("arguments other than a test build and its exclusions are refused with the usage", async () => {
      for (const buildArguments of [["foundation-core"], ["--without", "clock"], ["--test", "--without"], ["--test", "clock"], ["--test", "--test"]]) {
        const output = new TextOutputFixture();

        assert.equal(await BuildTests.create("unused", output, process.env).runAsync(buildArguments), 2);
        assert.equal(output.text, BuildTests.USAGE);
      }
    });

    test("the command exits with the build's result and terminates", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const command = SourceTreeFixture.locateScript("build.ts");
      const run = (commandArguments: readonly string[]): ReturnType<typeof spawnSync> =>
        spawnSync(process.execPath, [command, ...commandArguments], { cwd: repository.directory, encoding: "utf8", timeout: 10_000 });

      await repository.writeAsync({ "package.json": BuildTests.ROOT_MANIFEST });
      const empty = run([]);
      await repository.writeAsync({ "src/shell/runtime/package.json": "{}\n" });
      const invalid = run([]);
      const withArgument = run(["--watch"]);

      assert.equal(empty.status, 0);
      assert.equal(empty.stdout, "No packages under src/; there is nothing to build.\nModules in the build: 0.\nNo Angular project under src/; there is nothing to prepare.\n");
      assert.equal(invalid.status, 1);
      assert.equal(invalid.stdout, "src/shell/runtime/package.json must have a name.\n");
      assert.equal(withArgument.status, 2);
    });
  }

  private static create(root: string, output: TextOutputFixture, environment: NodeJS.ProcessEnv): Build {
    const runner = new ProcessRunner();
    const angular = new AngularProject(root, runner, new NpmCommand(runner, environment));
    return new Build(new PackageBuild(root, runner, environment), new ModuleCatalog(root), new ModuleArtifacts(root), angular, output);
  }
}

BuildTests.register();
