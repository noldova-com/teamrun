/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import PackageCatalog from "../../packages/package-catalog.ts";
import PackageException from "../../packages/package.exception.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class PackageCatalogTests {
  public static register(): void {
    test("a tree without a source folder or without manifests has no packages", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());

      assert.deepEqual(await new PackageCatalog(repository.directory).listPackagesAsync(), []);
      await repository.writeAsync({ "src/modules/checkpoints/README.md": "# Checkpoints\n", "package.json": "{}\n" });
      assert.deepEqual(await new PackageCatalog(repository.directory).listPackagesAsync(), []);
    });

    test("packages come after the packages they depend on, otherwise in path order, outside installed dependencies and the Angular project's manifest", async t => {
      const repository = await PackageCatalogTests.createAsync(t, {
        "src/shell/ui": ["foundation-core"],
        "src/shell/window": ["shell-ui", "foundation-json"],
        "src/foundation/json": ["foundation-core"],
        "src/foundation/core": [],
        "src/modules/terminal/window": ["shell-window", "foundation-core"]
      });
      await repository.writeAsync({
        "src/package.json": "{ \"name\": \"teamrun-window\", \"private\": true }\n",
        "src/package-lock.json": "{}\n",
        "src/node_modules/@angular/core/package.json": "{}\n",
        "src/shell/ui/node_modules/dependency/package.json": "{}\n",
        "src/shell/ui/src/package-notes.json": "{}\n"
      });

      const packages = await new PackageCatalog(repository.directory).listPackagesAsync();

      assert.deepEqual(packages.map(t => t.directory), ["src/foundation/core", "src/foundation/json", "src/shell/ui", "src/shell/window", "src/modules/terminal/window"]);
    });

    test("colliding names, unknown dependencies and cycles are refused", async t => {
      const colliding = await PackageCatalogTests.createAsync(t, { "src/shell/ui": [] });
      await colliding.writeAsync({ "src/shell-ui/package.json": JSON.stringify({ name: "@noldova/teamrun-shell-ui", version: "__VERSION__" }) });
      const unknown = await PackageCatalogTests.createAsync(t, { "src/shell/ui": ["foundation-core"] });
      const cycle = await PackageCatalogTests.createAsync(t, { "src/foundation/core": [], "src/shell/ui": ["shell-window", "foundation-core"], "src/shell/window": ["shell-ui"] });

      await assert.rejects(new PackageCatalog(colliding.directory).listPackagesAsync(),
        new PackageException("Package paths produce the same name: src/shell-ui, src/shell/ui."));
      await assert.rejects(new PackageCatalog(unknown.directory).listPackagesAsync(),
        new PackageException("src/shell/ui depends on @noldova/teamrun-foundation-core, which is not a package under src/."));
      await assert.rejects(new PackageCatalog(cycle.directory).listPackagesAsync(),
        new PackageException("The dependencies of @noldova/teamrun-shell-ui, @noldova/teamrun-shell-window form a cycle."));
    });
  }

  private static async createAsync(t: TestContext, packages: Readonly<Record<string, readonly string[]>>): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    const files: Record<string, string> = {};
    for (const [directory, dependencies] of Object.entries(packages))
      files[`${directory}/package.json`] = JSON.stringify({
        name: `@noldova/teamrun-${directory.slice("src/".length).replaceAll("/", "-")}`,
        version: "__VERSION__",
        dependencies: Object.fromEntries(dependencies.map(t => [`@noldova/teamrun-${t}`, "__VERSION__"]))
      });
    await repository.writeAsync(files);
    return repository;
  }
}

PackageCatalogTests.register();
