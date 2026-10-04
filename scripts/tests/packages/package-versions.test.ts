/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ModuleCatalog from "../../modules/module-catalog.ts";
import PackageManifest from "../../packages/package-manifest.ts";
import PackageVersions from "../../packages/package-versions.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class PackageVersionsTests {
  private static readonly NOTES: PackageManifest = new PackageManifest(
    "src/modules/notes/runtime",
    "@noldova/teamrun-modules-notes-runtime",
    ["@noldova/teamrun-modules-tasks-runtime", "@noldova/teamrun-shell-protocol"]);

  public static register(): void {
    test("a module's part packages take the module's version and every other package the product's", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const declare = (id: string, version: string, parts: readonly string[]): string =>
        JSON.stringify({ id, version, displayName: id, description: "Used by the tests.", parts, dependencies: [], contributes: {} });
      await repository.writeAsync({
        "src/modules/notes/module.json": declare("notes", "1.2.3", ["runtime", "window"]),
        "src/modules/notes/runtime/package.json": "{}\n",
        "src/modules/notes/window/package.json": "{}\n",
        "src/modules/tasks/module.json": declare("tasks", "1.2", ["runtime"]),
        "src/modules/tasks/runtime/package.json": "{}\n",
        [`${ModuleCatalog.FIXTURE_FOLDER}/clock/module.json`]: declare("clock", "0.4.0", ["runtime"]),
        [`${ModuleCatalog.FIXTURE_FOLDER}/clock/runtime/package.json`]: "{}\n"
      });
      const packages = [
        PackageVersionsTests.NOTES,
        new PackageManifest("src/modules/notes/window", "@noldova/teamrun-modules-notes-window", []),
        new PackageManifest("src/modules/tasks/runtime", "@noldova/teamrun-modules-tasks-runtime", []),
        new PackageManifest(`${ModuleCatalog.FIXTURE_FOLDER}/clock/runtime`, "@noldova/teamrun-fixture-clock-runtime", []),
        new PackageManifest("src/shell/protocol", "@noldova/teamrun-shell-protocol", [])
      ];

      const versions = await PackageVersions.readAsync(repository.directory, "0.0.7", packages);

      assert.deepEqual(packages.map(t => versions.of(t.name)), ["1.2.3", "1.2.3", "0.0.7", "0.4.0", "0.0.7"]);
    });

    test("a part package's manifest is stamped with its module's version and each own dependency's version", () => {
      const versions = new PackageVersions("0.0.7", new Map([["@noldova/teamrun-modules-notes-runtime", "1.2.3"], ["@noldova/teamrun-modules-tasks-runtime", "0.4.0"]]));
      const manifest = {
        name: "@noldova/teamrun-modules-notes-runtime",
        version: "__VERSION__",
        type: "module",
        dependencies: { "@noldova/teamrun-modules-tasks-runtime": "__VERSION__", "@noldova/teamrun-shell-protocol": "__VERSION__", "left-pad": "1.3.0" }
      };

      const stamped = versions.stampManifest(PackageVersionsTests.NOTES, JSON.stringify(manifest));
      const alone = versions.stampManifest(new PackageManifest("src/shell/protocol", "@noldova/teamrun-shell-protocol", []), JSON.stringify({ name: "@noldova/teamrun-shell-protocol", version: "__VERSION__" }));

      assert.deepEqual(JSON.parse(stamped), {
        ...manifest,
        version: "1.2.3",
        dependencies: { "@noldova/teamrun-modules-tasks-runtime": "0.4.0", "@noldova/teamrun-shell-protocol": "0.0.7", "left-pad": "1.3.0" }
      });
      assert.deepEqual(JSON.parse(alone), { name: "@noldova/teamrun-shell-protocol", version: "0.0.7" });
    });
  }
}

PackageVersionsTests.register();
