/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readlink, symlink } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import ElectronDistribution from "../../packaging/electron-distribution.ts";
import PackagingException from "../../packaging/packaging.exception.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class ElectronDistributionTests {
  public static register(): void {
    test("the copy of Electron's distribution leaves out its default app and version file and starts from an empty folder", async t => {
      const repository = await ElectronDistributionTests.createAsync(t);
      const folder = path.join(repository.directory, "_build", "package", "electron");
      const distribution = new ElectronDistribution(repository.directory, folder);
      await repository.writeAsync({ "_build/package/electron/left-over": "old\n" });

      await distribution.copyAsync();

      assert.equal(distribution.folder, folder);
      assert.equal(await distribution.readVersionAsync(), "44.5.1");
      assert.equal(await readFile(path.join(folder, "electron"), "utf8"), "program\n");
      assert.equal(await readFile(path.join(folder, "resources", "kept.pak"), "utf8"), "pak\n");
      assert.equal(await readFile(path.join(folder, "nested", "version"), "utf8"), "nested\n");
      assert.equal(existsSync(path.join(folder, "resources", "default_app.asar")), false);
      assert.equal(existsSync(path.join(folder, "version")), false);
      assert.equal(existsSync(path.join(folder, "left-over")), false);
    });

    test("symbolic links in the distribution stay links to the same relative target", { skip: process.platform === "win32" ? "Making symbolic links on Windows needs a privilege." : false }, async t => {
      const repository = await ElectronDistributionTests.createAsync(t);
      await symlink("resources/kept.pak", path.join(repository.directory, "node_modules", "electron", "dist", "current"));

      await new ElectronDistribution(repository.directory, path.join(repository.directory, "_build", "package", "electron")).copyAsync();

      assert.equal(await readlink(path.join(repository.directory, "_build", "package", "electron", "current")), "resources/kept.pak");
    });

    test("an Electron manifest without a version as text is refused", async t => {
      const repository = await ElectronDistributionTests.createAsync(t);
      const distribution = new ElectronDistribution(repository.directory, repository.directory);
      const failure = new PackagingException(`${path.join(repository.directory, "node_modules", "electron", "package.json")} has no version for Electron.`);

      for (const manifest of [{ name: "electron", version: 44 }, { name: "electron" }, null]) {
        await repository.writeAsync({ "node_modules/electron/package.json": JSON.stringify(manifest) });

        await assert.rejects(distribution.readVersionAsync(), failure);
      }
    });
  }

  private static async createAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({
      "node_modules/electron/package.json": JSON.stringify({ name: "electron", version: "44.5.1" }),
      "node_modules/electron/dist/electron": "program\n",
      "node_modules/electron/dist/version": "44.5.1",
      "node_modules/electron/dist/nested/version": "nested\n",
      "node_modules/electron/dist/resources/default_app.asar": "default app\n",
      "node_modules/electron/dist/resources/kept.pak": "pak\n"
    });
    return repository;
  }
}

ElectronDistributionTests.register();
