/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import PackageCheck from "../../checks/package-check.ts";
import PackageCatalog from "../../packages/package-catalog.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class PackageCheckTests {
  public static register(): void {
    test("a tree without packages passes and says there is nothing to test", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "src/modules/checkpoints/README.md": "# Checkpoints\n" });
      const output = new TextOutputFixture();
      const check = new PackageCheck(new PackageCatalog(repository.directory));

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "No packages under src/; there are no package tests to run.\n");
      assert.equal(check.title, "Packages");
    });

    test("a package manifest fails the check until package tests exist", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "src/foundation/core/package.json": "{}\n", "src/shell/protocol/package.json": "{}\n" });
      const output = new TextOutputFixture();

      assert.equal(await new PackageCheck(new PackageCatalog(repository.directory)).runAsync(output), false);
      assert.equal(output.text, "The tests cannot test packages yet. Found:\n  src/foundation/core/package.json\n  src/shell/protocol/package.json\n");
    });
  }
}

PackageCheckTests.register();
