/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import ModuleArtifacts from "../../modules/module-artifacts.ts";
import ModuleCatalog from "../../modules/module-catalog.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class ModuleArtifactsTests {
  private static readonly LICENSE_HEADER: string = [
    "/**",
    " * @license",
    " * Copyright (c) Noldova.",
    " *",
    " * This source code is licensed under the license found in the",
    " * LICENSE file in the root directory of this source tree.",
    " */",
    ""
  ].join("\n");

  public static register(): void {
    test("the declarations and the window parts' loaders are written in build order, or empty without modules", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "package.json": JSON.stringify({ teamrun: { modules: ["notes", "tasks"] } }),
        "src/modules/notes/module.json": JSON.stringify({ id: "notes", displayName: "Notes", parts: ["window"], dependencies: ["tasks"], contributes: { documents: ["notes.note"] } }),
        "src/modules/notes/window/src/api/index.ts": "export {};\n",
        "src/modules/tasks/module.json": JSON.stringify({ id: "tasks", displayName: "Tasks", parts: ["runtime"], dependencies: [], contributes: {} }),
        "src/modules/tasks/runtime/package.json": "{}\n",
        [`${ModuleCatalog.FIXTURE_FOLDER}/clock/module.json`]: JSON.stringify({ id: "clock", displayName: "Clock", parts: ["window"], dependencies: [], contributes: {} }),
        [`${ModuleCatalog.FIXTURE_FOLDER}/clock/window/src/api/index.ts`]: "export {};\n"
      });
      const artifacts = new ModuleArtifacts(repository.directory);

      await artifacts.writeAsync([]);
      const emptyDeclarations = await readFile(artifacts.declarationsFile, "utf8");
      const emptyParts = await readFile(artifacts.windowPartsFile, "utf8");
      await artifacts.writeAsync(await new ModuleCatalog(repository.directory).listBuildAsync(true, []));

      assert.equal(artifacts.declarationsFile, path.join(repository.directory, "_build", "modules", "declarations.json"));
      assert.equal(artifacts.windowPartsFile, path.join(repository.directory, "src", "generated", "window-parts.ts"));
      assert.deepEqual(JSON.parse(emptyDeclarations), { formatVersion: 1, modules: [] });
      assert.equal(emptyParts, `${ModuleArtifactsTests.LICENSE_HEADER}\nexport const windowPartLoaders: readonly (() => Promise<unknown>)[] = [];\n`);
      assert.deepEqual(JSON.parse(await readFile(artifacts.declarationsFile, "utf8")), {
        formatVersion: 1,
        modules: [
          { id: "tasks", displayName: "Tasks", dependencies: [], runtimePackage: "@noldova/teamrun-modules-tasks-runtime", contributes: {} },
          { id: "clock", displayName: "Clock", dependencies: [], runtimePackage: null, contributes: {} },
          { id: "notes", displayName: "Notes", dependencies: ["tasks"], runtimePackage: null, contributes: { documents: ["notes.note"] } }
        ]
      });
      assert.equal(await readFile(artifacts.windowPartsFile, "utf8"), [
        ModuleArtifactsTests.LICENSE_HEADER,
        "export const windowPartLoaders: readonly (() => Promise<unknown>)[] = [",
        "  () => import(\"../shell/desktop/tests/e2e/fixtures/modules/clock/window/src/api/index\"),",
        "  () => import(\"../modules/notes/window/src/api/index\")",
        "];",
        ""
      ].join("\n"));
    });
  }
}

ModuleArtifactsTests.register();
