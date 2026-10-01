/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import PackageCatalog from "../../packages/package-catalog.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class PackageCatalogTests {
  public static register(): void {
    test("a tree without a source folder or without manifests has no packages", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());

      assert.deepEqual(await new PackageCatalog(repository.directory).listManifestsAsync(), []);
      await repository.writeAsync({ "src/modules/checkpoints/README.md": "# Checkpoints\n", "package.json": "{}\n" });
      assert.deepEqual(await new PackageCatalog(repository.directory).listManifestsAsync(), []);
    });

    test("manifests anywhere under src are listed in order, outside installed dependencies", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/shell/protocol/package.json": "{}\n",
        "src/foundation/core/package.json": "{}\n",
        "src/modules/terminal/window/package.json": "{}\n",
        "src/modules/terminal/window/node_modules/dependency/package.json": "{}\n",
        "src/modules/terminal/window/src/package-notes.json": "{}\n"
      });

      assert.deepEqual(await new PackageCatalog(repository.directory).listManifestsAsync(), [
        "src/foundation/core/package.json",
        "src/modules/terminal/window/package.json",
        "src/shell/protocol/package.json"
      ]);
    });
  }
}

PackageCatalogTests.register();
