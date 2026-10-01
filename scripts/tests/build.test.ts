/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import Build from "../build.ts";
import PackageCatalog from "../packages/package-catalog.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class BuildTests {
  public static register(): void {
    test("a tree without packages builds nothing and succeeds", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "src/modules/checkpoints/README.md": "# Checkpoints\n" });
      const output = new TextOutputFixture();

      assert.equal(await new Build(new PackageCatalog(repository.directory), output).runAsync([]), 0);
      assert.equal(output.text, "No packages under src/; there is nothing to build.\n");
    });

    test("a package manifest fails the build until package builds exist", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "src/foundation/core/package.json": "{}\n" });
      const output = new TextOutputFixture();

      assert.equal(await new Build(new PackageCatalog(repository.directory), output).runAsync([]), 1);
      assert.equal(output.text, "The build cannot build packages yet. Found:\n  src/foundation/core/package.json\n");
    });

    test("arguments are refused with the usage", async () => {
      const output = new TextOutputFixture();

      assert.equal(await new Build(new PackageCatalog("unused"), output).runAsync(["foundation-core"]), 2);
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
      const withPackage = run([]);
      const withArgument = run(["--watch"]);

      assert.equal(empty.status, 0);
      assert.equal(empty.stdout, "No packages under src/; there is nothing to build.\n");
      assert.equal(withPackage.status, 1);
      assert.equal(withArgument.status, 2);
    });
  }
}

BuildTests.register();
