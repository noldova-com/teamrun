/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import PackageCheck from "../../checks/package-check.ts";
import PackageBuild from "../../packages/package-build.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import PackageTreeFixture from "../fixtures/package-tree.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class PackageCheckTests {
  public static register(): void {
    test("a tree without packages passes", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const output = new TextOutputFixture();
      const check = PackageCheckTests.create(repository.directory);

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "No packages under src/.\n");
      assert.equal(check.title, "Packages");
    });

    test("packages are built and installed", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await PackageTreeFixture.writeRootAsync(repository);
      await PackageTreeFixture.writePackageAsync(repository, "foundation-alpha", [], false);
      const output = new TextOutputFixture();

      assert.equal(await PackageCheckTests.create(repository.directory).runAsync(output), true);
      assert.equal(output.text, [
        "@noldova/teamrun-foundation-alpha: built",
        "Packages built and installed: 1.",
        ""
      ].join("\n"));
    });

    test("a package that cannot be built fails the check, and other errors are not hidden", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "src/shell/ui/package.json": "{ \"name\": \"@noldova/teamrun-shell-ui\" }\n" });
      const output = new TextOutputFixture();

      assert.equal(await PackageCheckTests.create(repository.directory).runAsync(output), false);
      await rm(path.join(repository.directory, "src"), { recursive: true });
      await PackageTreeFixture.writeRootAsync(repository);
      await PackageTreeFixture.writePackageAsync(repository, "foundation-alpha", [], false);
      await rm(path.join(repository.directory, "package-lock.json"));
      await assert.rejects(PackageCheckTests.create(repository.directory).runAsync(new TextOutputFixture()), /ENOENT/);

      assert.equal(output.text, "src/shell/ui/package.json must have the version \"__VERSION__\"; the build stamps the product version.\n");
    });
  }

  private static create(root: string): PackageCheck {
    return new PackageCheck(new PackageBuild(root, new ProcessRunner(), process.env));
  }
}

PackageCheckTests.register();
