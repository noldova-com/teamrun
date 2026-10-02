/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import ModuleCatalog from "../../modules/module-catalog.ts";
import ModuleDeclaration from "../../modules/module-declaration.ts";
import ModuleException from "../../modules/module.exception.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class ModuleDeclarationTests {
  private static readonly FOLDER: string = "src/modules/notes";
  private static readonly VALID: Readonly<Record<string, unknown>> = {
    id: "notes",
    displayName: "Notes",
    parts: ["runtime", "window"],
    dependencies: ["tasks", "git-hub2"],
    contributes: { methods: ["notes.list"], views: ["notes.list", "notes.outlineView"], themes: [] }
  };

  public static register(): void {
    test("a valid declaration is read with its parts, dependencies, contributions and generated names", async t => {
      const repository = await ModuleDeclarationTests.createAsync(t, ModuleDeclarationTests.FOLDER, ModuleDeclarationTests.VALID);
      await repository.writeAsync({ "src/modules/notes/runtime/package.json": "{}\n", "src/modules/notes/window/src/api/index.ts": "export {};\n" });
      const fixtureFolder = `${ModuleCatalog.FIXTURE_FOLDER}/clock`;
      await repository.writeAsync({ [`${fixtureFolder}/module.json`]: JSON.stringify({ ...ModuleDeclarationTests.VALID, id: "clock", parts: [], contributes: {} }) });

      const declaration = await ModuleDeclaration.readAsync(repository.directory, ModuleDeclarationTests.FOLDER, false);
      const fixture = await ModuleDeclaration.readAsync(repository.directory, fixtureFolder, true);

      assert.equal(ModuleDeclaration.hasDeclaration(repository.directory, ModuleDeclarationTests.FOLDER), true);
      assert.equal(ModuleDeclaration.hasDeclaration(repository.directory, "src/modules/tasks"), false);
      assert.equal(declaration.folder, ModuleDeclarationTests.FOLDER);
      assert.equal(declaration.file, "src/modules/notes/module.json");
      assert.equal(declaration.displayName, "Notes");
      assert.deepEqual(declaration.parts, ["runtime", "window"]);
      assert.equal(declaration.isFixture, false);
      assert.equal(declaration.runtimePackage, "@noldova/teamrun-modules-notes-runtime");
      assert.equal(declaration.windowEntry, "src/modules/notes/window/src/api/index");
      assert.deepEqual(declaration.toJson(), {
        id: "notes",
        displayName: "Notes",
        dependencies: ["tasks", "git-hub2"],
        runtimePackage: "@noldova/teamrun-modules-notes-runtime",
        contributes: { methods: ["notes.list"], views: ["notes.list", "notes.outlineView"], themes: [] }
      });
      assert.equal(fixture.isFixture, true);
      assert.equal(fixture.runtimePackage, null);
      assert.equal(fixture.windowEntry, null);
      await repository.writeAsync({ [`${fixtureFolder}/runtime/package.json`]: "{}\n", [`${fixtureFolder}/module.json`]: JSON.stringify({ ...ModuleDeclarationTests.VALID, id: "clock", parts: ["runtime"], contributes: {} }) });
      assert.equal((await ModuleDeclaration.readAsync(repository.directory, fixtureFolder, true)).runtimePackage, "@noldova/teamrun-fixture-clock-runtime");
    });

    test("a declaration that is no JSON object or has unknown fields is refused", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());

      await ModuleDeclarationTests.assertRefusedAsync(repository, "{", "could not be read as JSON");
      for (const value of ["[]", "null", "\"notes\""])
        await ModuleDeclarationTests.assertRefusedAsync(repository, value, "must be a JSON object");
      await ModuleDeclarationTests.assertRefusedAsync(repository, JSON.stringify({ ...ModuleDeclarationTests.VALID, version: 1, themes: [] }), "has unknown fields: version, themes");
    });

    test("an id other than its folder's name, a reserved or invalid id and a blank display name are refused", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const idRule = "must have the id \"notes\", its folder's name: lowercase kebab-case and not \"shell\"";

      for (const id of [undefined, 1, "tasks", "Notes"])
        await ModuleDeclarationTests.assertRefusedAsync(repository, JSON.stringify({ ...ModuleDeclarationTests.VALID, id }), idRule);
      for (const displayName of [undefined, " "])
        await ModuleDeclarationTests.assertRefusedAsync(repository, JSON.stringify({ ...ModuleDeclarationTests.VALID, displayName }), "must have a display name");
      await repository.writeAsync({ "src/modules/shell/module.json": JSON.stringify({ ...ModuleDeclarationTests.VALID, id: "shell" }), "src/modules/Notes/module.json": JSON.stringify({ ...ModuleDeclarationTests.VALID, id: "Notes" }) });
      await assert.rejects(ModuleDeclaration.readAsync(repository.directory, "src/modules/shell", false),
        new ModuleException("src/modules/shell/module.json must have the id \"shell\", its folder's name: lowercase kebab-case and not \"shell\"."));
      await assert.rejects(ModuleDeclaration.readAsync(repository.directory, "src/modules/Notes", false),
        new ModuleException("src/modules/Notes/module.json must have the id \"Notes\", its folder's name: lowercase kebab-case and not \"shell\"."));
    });

    test("unknown, repeated or missing parts and invalid or own dependencies are refused", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const partsRule = "must list its parts once each as runtime, window or cli";
      const dependenciesRule = "must list its dependencies once each as other modules' ids";

      for (const parts of [undefined, "window", ["desktop"], ["window", "window"], [1]])
        await ModuleDeclarationTests.assertRefusedAsync(repository, JSON.stringify({ ...ModuleDeclarationTests.VALID, parts }), partsRule);
      await ModuleDeclarationTests.assertRefusedAsync(repository, JSON.stringify({ ...ModuleDeclarationTests.VALID, parts: ["cli", "runtime"] }), "declares parts without a folder: cli, runtime");
      for (const dependencies of [undefined, ["notes"], ["Tasks"], ["tasks", "tasks"]])
        await ModuleDeclarationTests.assertRefusedAsync(repository, JSON.stringify({ ...ModuleDeclarationTests.VALID, parts: [], dependencies }), dependenciesRule);
    });

    test("contributions of unknown kinds or with names the module does not own are refused", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const valid = { ...ModuleDeclarationTests.VALID, parts: [] };

      for (const contributes of [undefined, null, [], "views"])
        await ModuleDeclarationTests.assertRefusedAsync(repository, JSON.stringify({ ...valid, contributes }), "must list its contributions as an object");
      await ModuleDeclarationTests.assertRefusedAsync(repository, JSON.stringify({ ...valid, contributes: { commands: [] } }), "contributes an unknown kind: commands");
      for (const views of ["notes.list", [1], ["tasks.list"], ["notes."], ["notes.List"], ["notes.list-view"], ["notes"]])
        await ModuleDeclarationTests.assertRefusedAsync(repository, JSON.stringify({ ...valid, contributes: { views } }), "must list its views as \"notes.<name>\", with a camelCase name");
    });
  }

  private static async createAsync(t: TestContext, folder: string, declaration: Readonly<Record<string, unknown>>): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({ [`${folder}/module.json`]: JSON.stringify(declaration) });
    return repository;
  }

  private static async assertRefusedAsync(repository: RepositoryFixture, text: string, problem: string): Promise<void> {
    await repository.writeAsync({ "src/modules/notes/module.json": text });
    await assert.rejects(ModuleDeclaration.readAsync(repository.directory, ModuleDeclarationTests.FOLDER, false),
      new ModuleException(`src/modules/notes/module.json ${problem}.`));
  }
}

ModuleDeclarationTests.register();
