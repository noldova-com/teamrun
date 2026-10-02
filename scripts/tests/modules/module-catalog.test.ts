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
import ModuleException from "../../modules/module.exception.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class ModuleCatalogTests {
  private static readonly LIST_REQUIRED: ModuleException = new ModuleException("The root package.json must list the build's modules once each in teamrun.modules.");

  public static register(): void {
    test("all declarations of modules and fixture modules are read, and invalid ones are reported as problems", async t => {
      const empty = await ModuleCatalogTests.createAsync(t, {});
      const repository = await ModuleCatalogTests.createAsync(t, {
        "src/modules/tasks/module.json": ModuleCatalogTests.declare("tasks", []),
        "src/modules/notes/module.json": ModuleCatalogTests.declare("notes", ["tasks"]),
        "src/modules/notes.md": "# Notes\n",
        "src/modules/checkpoints/README.md": "# Checkpoints\n",
        "src/modules/broken/module.json": "{",
        [`${ModuleCatalog.FIXTURE_FOLDER}/clock/module.json`]: ModuleCatalogTests.declare("clock", [])
      });

      const none = await new ModuleCatalog(empty.directory).readAllAsync();
      const inventory = await new ModuleCatalog(repository.directory).readAllAsync();

      assert.deepEqual(none.declarations, []);
      assert.deepEqual(none.problems, []);
      assert.deepEqual(inventory.declarations.map(t => [t.id, t.isFixture]), [["notes", false], ["tasks", false], ["clock", true]]);
      assert.deepEqual(inventory.problems, ["src/modules/broken/module.json could not be read as JSON."]);
    });

    test("the build lists its modules after their dependencies, adds fixture modules to a test build and leaves out the named ones", async t => {
      const repository = await ModuleCatalogTests.createAsync(t, {
        "package.json": JSON.stringify({ teamrun: { modules: ["notes", "tasks"] } }),
        "src/modules/notes/module.json": ModuleCatalogTests.declare("notes", ["tasks"]),
        "src/modules/tasks/module.json": ModuleCatalogTests.declare("tasks", []),
        "src/modules/unlisted/module.json": ModuleCatalogTests.declare("unlisted", []),
        [`${ModuleCatalog.FIXTURE_FOLDER}/clock/module.json`]: ModuleCatalogTests.declare("clock", ["notes"]),
        [`${ModuleCatalog.FIXTURE_FOLDER}/weather/module.json`]: ModuleCatalogTests.declare("weather", [])
      });
      const catalog = new ModuleCatalog(repository.directory);

      const regular = await catalog.listBuildAsync(false, []);
      const tested = await catalog.listBuildAsync(true, []);
      const without = await catalog.listBuildAsync(true, ["clock", "weather"]);

      assert.deepEqual(regular.map(t => t.id), ["tasks", "notes"]);
      assert.deepEqual(tested.map(t => t.id), ["tasks", "weather", "notes", "clock"]);
      assert.deepEqual(without.map(t => t.id), ["tasks", "notes"]);
      await assert.rejects(catalog.listBuildAsync(true, ["notes"]), new ModuleException("clock depends on notes, which the build does not include."));
      await assert.rejects(catalog.listBuildAsync(false, ["clock", "radio"]), new ModuleException("The build has no module clock, radio to leave out."));
    });

    test("a listed module without a declaration, a repeated id, a missing dependency and a cycle are refused", async t => {
      const undeclared = await ModuleCatalogTests.createAsync(t, { "package.json": JSON.stringify({ teamrun: { modules: ["notes"] } }) });
      const repeated = await ModuleCatalogTests.createAsync(t, {
        "package.json": JSON.stringify({ teamrun: { modules: ["clock"] } }),
        "src/modules/clock/module.json": ModuleCatalogTests.declare("clock", []),
        [`${ModuleCatalog.FIXTURE_FOLDER}/clock/module.json`]: ModuleCatalogTests.declare("clock", [])
      });
      const missing = await ModuleCatalogTests.createAsync(t, {
        "package.json": JSON.stringify({ teamrun: { modules: ["notes"] } }),
        "src/modules/notes/module.json": ModuleCatalogTests.declare("notes", ["tasks", "radio"])
      });
      const cycle = await ModuleCatalogTests.createAsync(t, {
        "package.json": JSON.stringify({ teamrun: { modules: ["notes", "tasks"] } }),
        "src/modules/notes/module.json": ModuleCatalogTests.declare("notes", ["tasks"]),
        "src/modules/tasks/module.json": ModuleCatalogTests.declare("tasks", ["notes"])
      });

      await assert.rejects(new ModuleCatalog(undeclared.directory).listBuildAsync(false, []),
        new ModuleException("The build lists the module notes, but src/modules/notes has no module.json."));
      assert.deepEqual((await new ModuleCatalog(repeated.directory).listBuildAsync(false, [])).map(t => t.id), ["clock"]);
      await assert.rejects(new ModuleCatalog(repeated.directory).listBuildAsync(true, []),
        new ModuleException(`Module ids repeat in the build: src/modules/clock, ${ModuleCatalog.FIXTURE_FOLDER}/clock.`));
      await assert.rejects(new ModuleCatalog(missing.directory).listBuildAsync(false, []),
        new ModuleException("notes depends on tasks, radio, which the build does not include."));
      await assert.rejects(new ModuleCatalog(cycle.directory).listBuildAsync(false, []),
        new ModuleException("The dependencies of notes, tasks form a cycle."));
    });

    test("a root manifest without a list of distinct module ids is refused", async t => {
      const repository = await ModuleCatalogTests.createAsync(t, {});
      const catalog = new ModuleCatalog(repository.directory);

      await assert.rejects(catalog.listBuildAsync(false, []), ModuleCatalogTests.LIST_REQUIRED);
      for (const manifest of ["{", "1", "null", "[]", "{}", "{ \"teamrun\": null }", "{ \"teamrun\": 1 }", "{ \"teamrun\": {} }",
        "{ \"teamrun\": { \"modules\": \"notes\" } }", "{ \"teamrun\": { \"modules\": [1] } }", "{ \"teamrun\": { \"modules\": [\"notes\", \"notes\"] } }"]) {
        await repository.writeAsync({ "package.json": manifest });
        await assert.rejects(catalog.listBuildAsync(false, []), ModuleCatalogTests.LIST_REQUIRED);
      }
    });
  }

  private static declare(id: string, dependencies: readonly string[]): string {
    return JSON.stringify({ id, displayName: id, parts: [], dependencies, contributes: {} });
  }

  private static async createAsync(t: TestContext, files: Readonly<Record<string, string>>): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync(files);
    return repository;
  }
}

ModuleCatalogTests.register();
