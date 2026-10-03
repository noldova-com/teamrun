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
  private static readonly SOURCE_IMPORT: string = "import { WindowPartSource } from \"@noldova/teamrun-shell-window\";\n";

  public static register(): void {
    test("the declarations and the window parts' loaders are written in build order, or empty without modules", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "package.json": JSON.stringify({ teamrun: { modules: ["notes", "tasks"] } }),
        "src/modules/notes/module.json": JSON.stringify({ id: "notes", displayName: "Notes", parts: ["window"], dependencies: ["tasks"], contributes: { views: ["notes.list", "notes.outline"], commands: ["notes.newNote"], documents: ["notes.note"] } }),
        "src/modules/notes/window/src/api/index.ts": "export {};\n",
        "src/modules/tasks/module.json": JSON.stringify({ id: "tasks", displayName: "Tasks", parts: ["runtime"], dependencies: [], contributes: {} }),
        "src/modules/tasks/runtime/package.json": "{}\n",
        [`${ModuleCatalog.FIXTURE_FOLDER}/clock/module.json`]: JSON.stringify({ id: "clock", displayName: "Clock", parts: ["window"], dependencies: [], contributes: {} }),
        [`${ModuleCatalog.FIXTURE_FOLDER}/clock/window/src/api/index.ts`]: "export {};\n"
      });
      const artifacts = new ModuleArtifacts(repository.directory);

      const variant = path.join(repository.directory, "_build", "variants", "empty");

      await artifacts.writeAsync([], variant);
      const emptyDeclarations = await readFile(artifacts.locateDeclarations(variant), "utf8");
      const emptyParts = await readFile(artifacts.windowPartsFile, "utf8");
      await artifacts.writeAsync(await new ModuleCatalog(repository.directory).listBuildAsync(true, []), null);

      assert.equal(artifacts.declarationsFile, path.join(repository.directory, "_build", "modules", "declarations.json"));
      assert.equal(artifacts.locateDeclarations(null), artifacts.declarationsFile);
      assert.equal(artifacts.locateDeclarations(variant), path.join(variant, "modules", "declarations.json"));
      assert.equal(artifacts.windowPartsFile, path.join(repository.directory, "src", "generated", "window-parts.ts"));
      assert.deepEqual(JSON.parse(emptyDeclarations), { formatVersion: 1, modules: [] });
      assert.equal(
        emptyParts,
        `${ModuleArtifactsTests.LICENSE_HEADER}\n${ModuleArtifactsTests.SOURCE_IMPORT}\nexport const windowPartSources: readonly WindowPartSource[] = [];\n`);
      assert.deepEqual(JSON.parse(await readFile(artifacts.declarationsFile, "utf8")), {
        formatVersion: 1,
        modules: [
          { id: "tasks", displayName: "Tasks", dependencies: [], runtimePackage: "@noldova/teamrun-modules-tasks-runtime", contributes: {} },
          { id: "clock", displayName: "Clock", dependencies: [], runtimePackage: null, contributes: {} },
          { id: "notes", displayName: "Notes", dependencies: ["tasks"], runtimePackage: null, contributes: { views: ["notes.list", "notes.outline"], commands: ["notes.newNote"], documents: ["notes.note"] } }
        ]
      });
      assert.equal(await readFile(artifacts.windowPartsFile, "utf8"), [
        ModuleArtifactsTests.LICENSE_HEADER,
        ModuleArtifactsTests.SOURCE_IMPORT,
        "export const windowPartSources: readonly WindowPartSource[] = [",
        "  new WindowPartSource(\"clock\", \"Clock\", [], [], [], () => import(\"../shell/desktop/tests/e2e/fixtures/modules/clock/window/src/api/index\").then(t => t.windowPart)),",
        "  new WindowPartSource(\"notes\", \"Notes\", [\"tasks\"], [\"notes.list\",\"notes.outline\"], [\"notes.newNote\"], () => import(\"../modules/notes/window/src/api/index\").then(t => t.windowPart))",
        "];",
        ""
      ].join("\n"));
    });
  }
}

ModuleArtifactsTests.register();
