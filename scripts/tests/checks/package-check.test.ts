/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import PackageCheck from "../../checks/package-check.ts";
import BuildVariant from "../../modules/build-variant.ts";
import PackageBuild from "../../packages/package-build.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import PackageTreeFixture from "../fixtures/package-tree.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class PackageCheckTests {
  private static readonly BUILD_TIMEOUT: number = 60_000;

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

    test("packages are built and installed", { timeout: PackageCheckTests.BUILD_TIMEOUT }, async t => {
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

    test("a source change the check rebuilds gives the build's product file the new fingerprint", { timeout: PackageCheckTests.BUILD_TIMEOUT }, async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await PackageTreeFixture.writeRootAsync(repository);
      await PackageTreeFixture.writePackageAsync(repository, "foundation-alpha", [], false);
      const build = new PackageBuild(repository.directory, new ProcessRunner(), process.env, process.platform, process.arch);
      const readBuildAsync = async (): Promise<unknown> => JSON.parse(await readFile(path.join(repository.directory, "_build", "product.json"), "utf8")).build;

      assert.equal(await PackageCheckTests.create(repository.directory).runAsync(new TextOutputFixture()), true);
      const first = await readBuildAsync();
      assert.equal(first, await build.hashFingerprintAsync(BuildVariant.REGULAR));
      await repository.writeAsync({ "src/foundation/alpha/src/resources.ts": "export default class Resources {\n  public static readonly version: string = \"changed\";\n  public static readonly protocol: string = \"\";\n}\n" });
      assert.equal(await PackageCheckTests.create(repository.directory).runAsync(new TextOutputFixture()), true);

      assert.notEqual(await readBuildAsync(), first);
      assert.equal(await readBuildAsync(), await build.hashFingerprintAsync(BuildVariant.REGULAR));
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

      assert.equal(output.text, "src/shell/ui/package.json must have the version \"__VERSION__\"; the build stamps its module's version or the product version.\n");
    });
  }

  private static create(root: string): PackageCheck {
    return new PackageCheck(new PackageBuild(root, new ProcessRunner(), process.env, process.platform, process.arch));
  }
}

PackageCheckTests.register();
