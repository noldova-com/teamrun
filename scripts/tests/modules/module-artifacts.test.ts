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
  private static readonly SOURCE_IMPORT: string = "import { MenuDeclarations, WindowPartSource } from \"@noldova/teamrun-shell-window/build\";\n";
  private static readonly MENUS: Readonly<Record<string, unknown>> = {
    places: [{ name: "notes.templates", title: "New from template" }],
    groups: [
      { name: "notes.create", place: "shell.file", items: [{ command: "notes.newNote" }, { submenu: "notes.templates" }] },
      { name: "notes.sorting", place: "notes.templates", exclusive: true, items: [{ command: "notes.newNote", arguments: { template: "plan" } }] }
    ]
  };
  private static readonly WRAP: Readonly<Record<string, unknown>> = {
    name: "notes.wrap", title: "Wrap lines", description: "Wraps long lines.", type: { kind: "Boolean" }, default: true, locality: "Device", scopes: [], page: "Notes", group: "Editor"
  };

  public static register(): void {
    test("the declarations and the window parts' loaders are written in build order, or empty without modules", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "package.json": JSON.stringify({ teamrun: { modules: ["notes", "tasks"] } }),
        "src/modules/notes/module.json": JSON.stringify({ id: "notes", version: "0.0.1", displayName: "Notes", description: "Used by the tests.", parts: ["window"], dependencies: ["tasks"], contributes: {
          views: ["notes.list", "notes.outline"], commands: ["notes.newNote"], documents: ["notes.note"], statusBarItems: ["notes.count"], topBarActions: ["notes.compose"],
          menus: ["notes.templates"],
          settings: ["notes.wrap"]
        }
      }),
        "src/modules/notes/menus.json": JSON.stringify(ModuleArtifactsTests.MENUS),
        "src/modules/notes/settings.json": JSON.stringify({ settings: [ModuleArtifactsTests.WRAP] }),
        "src/modules/notes/window/src/api/index.ts": "export {};\n",
        "src/modules/tasks/module.json": JSON.stringify({ id: "tasks", version: "0.0.1", displayName: "Tasks", description: "Used by the tests.", parts: ["runtime"], dependencies: [], contributes: {} }),
        "src/modules/tasks/runtime/package.json": "{}\n",
        [`${ModuleCatalog.FIXTURE_FOLDER}/clock/module.json`]: JSON.stringify({ id: "clock", version: "0.0.1", displayName: "Clock", description: "Used by the tests.", parts: ["window"], dependencies: [], contributes: {} }),
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
        `${ModuleArtifactsTests.LICENSE_HEADER}\n${ModuleArtifactsTests.SOURCE_IMPORT}\nexport const windowPartSources: readonly WindowPartSource[] = [];\n\n`
          + "export const moduleMenus: readonly MenuDeclarations[] = [];\n");
      assert.deepEqual(JSON.parse(await readFile(artifacts.declarationsFile, "utf8")), {
        formatVersion: 1,
        modules: [
          { id: "tasks", version: "0.0.1", displayName: "Tasks", description: "Used by the tests.", dependencies: [], runtimePackage: "@noldova/teamrun-modules-tasks-runtime", cliPackage: null, contributes: {}, settings: [], cliCommands: [] },
          { id: "clock", version: "0.0.1", displayName: "Clock", description: "Used by the tests.", dependencies: [], runtimePackage: null, cliPackage: null, contributes: {}, settings: [], cliCommands: [] },
          {
            id: "notes", version: "0.0.1", displayName: "Notes", description: "Used by the tests.", dependencies: ["tasks"], runtimePackage: null, cliPackage: null, contributes: {
              views: ["notes.list", "notes.outline"], commands: ["notes.newNote"], documents: ["notes.note"], statusBarItems: ["notes.count"], topBarActions: ["notes.compose"],
              menus: ["notes.templates"], settings: ["notes.wrap"]
            },
            settings: [ModuleArtifactsTests.WRAP],
            cliCommands: []
          }
        ]
      });
      assert.equal(await readFile(artifacts.windowPartsFile, "utf8"), [
        ModuleArtifactsTests.LICENSE_HEADER,
        ModuleArtifactsTests.SOURCE_IMPORT,
        "export const windowPartSources: readonly WindowPartSource[] = [",
        "  new WindowPartSource(\"clock\", [], [], [], [], [], [], [], () => import(\"../shell/desktop/tests/e2e/fixtures/modules/clock/window/src/api/index\").then(t => t.windowPart)),",
        "  new WindowPartSource(\"notes\", [\"tasks\"], [\"notes.list\",\"notes.outline\"], [\"notes.note\"], [\"notes.newNote\"], [\"notes.count\"], [\"notes.compose\"], [], () => import(\"../modules/notes/window/src/api/index\").then(t => t.windowPart))",
        "];",
        "",
        "export const moduleMenus: readonly MenuDeclarations[] = [",
        `  MenuDeclarations.fromJson("notes", ${JSON.stringify({
          places: [{ name: "notes.templates", title: "New from template", shows: "menu" }],
          groups: [
            { name: "notes.create", place: "shell.file", exclusive: false, items: [{ command: "notes.newNote", arguments: {} }, { submenu: "notes.templates" }] },
            { name: "notes.sorting", place: "notes.templates", exclusive: true, items: [{ command: "notes.newNote", arguments: { template: "plan" } }] }
          ]
        })})`,
        "];",
        ""
      ].join("\n"));
    });
  }
}

ModuleArtifactsTests.register();
