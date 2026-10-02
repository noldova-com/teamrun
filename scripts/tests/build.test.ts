/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import AngularProject from "../angular/angular-project.ts";
import Build from "../build.ts";
import PackageBuild from "../packages/package-build.ts";
import ProcessRunner from "../processes/process-runner.ts";
import NpmCommand from "../toolchain/npm-command.ts";
import PackageTreeFixture from "./fixtures/package-tree.fixture.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class BuildTests {
  private static readonly BUILD_TIMEOUT: number = 60_000;

  public static register(): void {
    test("a tree without packages builds nothing and succeeds", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "src/modules/checkpoints/README.md": "# Checkpoints\n" });
      const output = new TextOutputFixture();

      assert.equal(await BuildTests.create(repository.directory, output, process.env).runAsync([]), 0);
      assert.equal(output.text, "No packages under src/; there is nothing to build.\nNo Angular project under src/; there is nothing to prepare.\n");
    });

    test("packages are built and installed, and the build says how many", { timeout: BuildTests.BUILD_TIMEOUT }, async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await PackageTreeFixture.writeRootAsync(repository);
      await PackageTreeFixture.writePackageAsync(repository, "foundation-alpha", [], false);
      const output = new TextOutputFixture();

      assert.equal(await BuildTests.create(repository.directory, output, process.env).runAsync([]), 0);
      assert.equal(output.text, "@noldova/teamrun-foundation-alpha: built\nPackages built and installed: 1.\nNo Angular project under src/; there is nothing to prepare.\n");
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

    test("arguments are refused with the usage", async () => {
      const output = new TextOutputFixture();

      assert.equal(await BuildTests.create("unused", output, process.env).runAsync(["foundation-core"]), 2);
      assert.equal(output.text, "Usage: npm run build\n");
    });

    test("the command exits with the build's result and terminates", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const command = SourceTreeFixture.locateScript("build.ts");
      const run = (commandArguments: readonly string[]): ReturnType<typeof spawnSync> =>
        spawnSync(process.execPath, [command, ...commandArguments], { cwd: repository.directory, encoding: "utf8", timeout: 10_000 });

      const empty = run([]);
      await repository.writeAsync({ "src/shell/runtime/package.json": "{}\n" });
      const invalid = run([]);
      const withArgument = run(["--watch"]);

      assert.equal(empty.status, 0);
      assert.equal(empty.stdout, "No packages under src/; there is nothing to build.\nNo Angular project under src/; there is nothing to prepare.\n");
      assert.equal(invalid.status, 1);
      assert.equal(invalid.stdout, "src/shell/runtime/package.json must have a name.\n");
      assert.equal(withArgument.status, 2);
    });
  }

  private static create(root: string, output: TextOutputFixture, environment: NodeJS.ProcessEnv): Build {
    const runner = new ProcessRunner();
    return new Build(new PackageBuild(root, runner, environment), new AngularProject(root, runner, new NpmCommand(runner, environment)), output);
  }
}

BuildTests.register();
