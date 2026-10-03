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
import ModuleMenus from "../../modules/module-menus.ts";
import ModuleException from "../../modules/module.exception.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class ModuleMenusTests {
  private static readonly FOLDER: string = "src/modules/notes";
  private static readonly DECLARED: readonly string[] = ["notes.templates", "notes.tools"];
  private static readonly VALID: Readonly<Record<string, unknown>> = {
    places: [{ name: "notes.templates", title: "New from template" }, { name: "notes.tools", title: "Notes", menuBar: true }],
    groups: [
      { name: "notes.create", place: "shell.file", items: [{ command: "notes.newNote" }, { submenu: "notes.templates" }] },
      { name: "notes.sorting", place: "notes.tools", exclusive: true, items: [{ command: "notes.sortBy", arguments: { by: "title" }, label: "By title" }] }
    ]
  };

  public static register(): void {
    test("a module's menus are read with their places, groups and items, filling in the defaults", async t => {
      const repository = await ModuleMenusTests.createAsync(t, ModuleMenusTests.VALID);

      const menus = await ModuleMenus.readAsync(repository.directory, ModuleMenusTests.FOLDER, "notes", ModuleMenusTests.DECLARED);

      assert.deepEqual(menus.toJson(), {
        places: [{ name: "notes.templates", title: "New from template", menuBar: false }, { name: "notes.tools", title: "Notes", menuBar: true }],
        groups: [
          { name: "notes.create", place: "shell.file", exclusive: false, items: [{ command: "notes.newNote", arguments: {} }, { submenu: "notes.templates" }] },
          { name: "notes.sorting", place: "notes.tools", exclusive: true, items: [{ command: "notes.sortBy", arguments: { by: "title" }, label: "By title" }] }
        ]
      });
    });

    test("a module without menus.json has no menus, unless module.json declares places", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());

      const menus = await ModuleMenus.readAsync(repository.directory, ModuleMenusTests.FOLDER, "notes", []);

      assert.equal(menus, ModuleMenus.EMPTY);
      await assert.rejects(ModuleMenus.readAsync(repository.directory, ModuleMenusTests.FOLDER, "notes", ["notes.tools"]),
        new ModuleException("src/modules/notes/module.json declares menus, but src/modules/notes/menus.json does not exist."));
    });

    test("a file that is not JSON or not an object with places and groups is refused", async t => {
      const repository = await ModuleMenusTests.createAsync(t, ModuleMenusTests.VALID);
      await repository.writeAsync({ [`${ModuleMenusTests.FOLDER}/menus.json`]: "{" });

      await assert.rejects(ModuleMenus.readAsync(repository.directory, ModuleMenusTests.FOLDER, "notes", []),
        new ModuleException("src/modules/notes/menus.json could not be read as JSON."));
      for (const value of [[], null, { places: [], groups: [], toolbars: [] }])
        await ModuleMenusTests.assertRefusedAsync(repository, value, "must be a JSON object with places and groups");
      await ModuleMenusTests.assertRefusedAsync(repository, { groups: [] }, "must list its places");
      await ModuleMenusTests.assertRefusedAsync(repository, { places: ModuleMenusTests.places(), groups: {} }, "must list its groups");
    });

    test("a place that is undeclared, untitled, repeated, missing or with an invalid menuBar is refused", async t => {
      const repository = await ModuleMenusTests.createAsync(t, ModuleMenusTests.VALID);
      const tools = { name: "notes.tools", title: "Notes" };
      const cases: readonly [unknown, string][] = [
        [[{ name: "notes.templates", title: "T", order: 1 }, tools], "must describe each place with a name, a title and optionally menuBar"],
        [[{ name: "notes.other", title: "Other" }, tools], "describes the place notes.other, which module.json does not declare in contributes.menus"],
        [[{ name: "notes.templates", title: " " }, tools], "must give the place notes.templates a title"],
        [[{ name: "notes.templates", title: "T", menuBar: "yes" }, tools], "must give the place notes.templates a menuBar of true or false"],
        [[tools, tools], "describes a place more than once"],
        [[tools], "does not describe the declared places notes.templates"]
      ];

      for (const [places, problem] of cases)
        await ModuleMenusTests.assertRefusedAsync(repository, { places, groups: [] }, problem);
    });

    test("a group with an invalid name, place, exclusive or items, or a repeated name, is refused", async t => {
      const repository = await ModuleMenusTests.createAsync(t, ModuleMenusTests.VALID);
      const item = { command: "notes.newNote" };
      const cases: readonly [unknown, string][] = [
        [[{ name: "notes.create", place: "shell.file", items: [item], order: 1 }], "must describe each group with a name, a place, its items and optionally exclusive"],
        [[{ name: "tasks.create", place: "shell.file", items: [item] }], "must name each group \"notes.<name>\", with a camelCase name"],
        [[{ name: "notes.Create", place: "shell.file", items: [item] }], "must name each group \"notes.<name>\", with a camelCase name"],
        [[{ name: "notes.create", place: "file", items: [item] }], "must put the group notes.create in a place named \"<id>.<name>\""],
        [[{ name: "notes.create", place: "shell.file", exclusive: 1, items: [item] }], "must give the group notes.create an exclusive of true or false"],
        [[{ name: "notes.create", place: "shell.file", items: {} }], "must list its items of the group notes.create"],
        [[{ name: "notes.create", place: "shell.file", items: [] }], "must give the group notes.create at least one item"],
        [[{ name: "notes.create", place: "shell.file", items: [item] }, { name: "notes.create", place: "shell.edit", items: [item] }], "names a group more than once"]
      ];

      for (const [groups, problem] of cases)
        await ModuleMenusTests.assertRefusedAsync(repository, { places: ModuleMenusTests.places(), groups }, problem);
    });

    test("an item that is neither a command nor its module's own submenu, or with arguments that are not an object or a blank label, is refused", async t => {
      const repository = await ModuleMenusTests.createAsync(t, ModuleMenusTests.VALID);
      const shape = "must make each item of the group notes.create either a command with optional arguments and label, or a submenu";
      const cases: readonly [unknown, string][] = [
        [{ command: "notes.newNote", title: "New" }, shape],
        [{ submenu: "notes.templates", command: "notes.newNote" }, shape],
        ["notes.newNote", shape],
        [{ submenu: "tasks.tools" }, "opens tasks.tools as a submenu in the group notes.create, which is not one of its own places"],
        [{ command: "newNote" }, "must name a command \"<id>.<name>\" for each item of the group notes.create"],
        [{ command: "notes.newNote", arguments: [1] }, "must give the arguments of notes.newNote in the group notes.create as a JSON object"],
        [{ command: "notes.newNote", arguments: null }, "must give the arguments of notes.newNote in the group notes.create as a JSON object"],
        [{ command: "notes.newNote", label: " " }, "must give the label of notes.newNote in the group notes.create as text that is not blank"],
        [{ command: "notes.newNote", label: 1 }, "must give the label of notes.newNote in the group notes.create as text that is not blank"],
        [{ command: "notes.newNote", label: null }, "must give the label of notes.newNote in the group notes.create as text that is not blank"]
      ];

      for (const [item, problem] of cases)
        await ModuleMenusTests.assertRefusedAsync(repository, { places: ModuleMenusTests.places(), groups: [{ name: "notes.create", place: "shell.file", items: [item] }] }, problem);
    });

    test("a place that opens itself, directly or through another place, is refused", async t => {
      const repository = await ModuleMenusTests.createAsync(t, ModuleMenusTests.VALID);

      await ModuleMenusTests.assertRefusedAsync(repository, {
        places: ModuleMenusTests.places(),
        groups: [{ name: "notes.loop", place: "notes.tools", items: [{ submenu: "notes.tools" }] }]
      }, "opens notes.tools inside itself: notes.tools > notes.tools");
      await ModuleMenusTests.assertRefusedAsync(repository, {
        places: ModuleMenusTests.places(),
        groups: [
          { name: "notes.there", place: "notes.tools", items: [{ submenu: "notes.templates" }] },
          { name: "notes.back", place: "notes.templates", items: [{ submenu: "notes.tools" }] }
        ]
      }, "opens notes.tools inside itself: notes.tools > notes.templates > notes.tools");
    });

    test("a group refers only to places and commands the module may use", async t => {
      const repository = await ModuleMenusTests.createAsync(t, ModuleMenusTests.VALID);
      const menus = await ModuleMenus.readAsync(repository.directory, ModuleMenusTests.FOLDER, "notes", ModuleMenusTests.DECLARED);
      const places = new Set([...ModuleMenus.SHELL_PLACES, ...ModuleMenusTests.DECLARED]);

      menus.checkReferences("notes", places, new Set(["notes.newNote", "notes.sortBy"]));

      assert.throws(() => menus.checkReferences("notes", new Set(ModuleMenus.SHELL_PLACES), new Set(["notes.newNote", "notes.sortBy"])), new ModuleException(
        "notes's menus.json adds the group notes.sorting to notes.tools, which is neither the shell's place nor its own or a dependency's."));
      assert.throws(() => menus.checkReferences("notes", places, new Set(["notes.newNote"])), new ModuleException(
        "notes's menus.json runs notes.sortBy, which neither it nor a module it depends on declares."));
    });

    test("the build checks each module's menus against its own and its dependencies' places and commands", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const module = (id: string, dependencies: readonly string[], contributes: Readonly<Record<string, unknown>>): string =>
        JSON.stringify({ id, displayName: id, parts: [], dependencies, contributes });
      const notesMenus = (place: string, command: string): string =>
        JSON.stringify({ places: [], groups: [{ name: "notes.extra", place, items: [{ command }] }] });
      await repository.writeAsync({
        "package.json": JSON.stringify({ teamrun: { modules: ["notes", "tasks", "clock"] } }),
        "src/modules/tasks/module.json": module("tasks", [], { commands: ["tasks.add"], menus: ["tasks.tools"] }),
        "src/modules/tasks/menus.json": JSON.stringify({ places: [{ name: "tasks.tools", title: "Tasks", menuBar: true }], groups: [] }),
        "src/modules/clock/module.json": module("clock", [], { commands: ["clock.tick"], menus: ["clock.tools"] }),
        "src/modules/clock/menus.json": JSON.stringify({ places: [{ name: "clock.tools", title: "Clock" }], groups: [] }),
        "src/modules/notes/module.json": module("notes", ["tasks"], {}),
        "src/modules/notes/menus.json": notesMenus("tasks.tools", "tasks.add")
      });
      const catalog = new ModuleCatalog(repository.directory);

      assert.deepEqual((await catalog.listBuildAsync(false, [])).map(t => t.id), ["tasks", "clock", "notes"]);
      await repository.writeAsync({ "src/modules/notes/menus.json": notesMenus("clock.tools", "tasks.add") });
      await assert.rejects(catalog.listBuildAsync(false, []), /adds the group notes\.extra to clock\.tools/);
      await repository.writeAsync({ "src/modules/notes/menus.json": notesMenus("shell.view", "clock.tick") });
      await assert.rejects(catalog.listBuildAsync(false, []), /runs clock\.tick, which neither it nor a module it depends on declares/);
    });
  }

  private static places(): readonly Readonly<Record<string, unknown>>[] {
    return [{ name: "notes.templates", title: "New from template" }, { name: "notes.tools", title: "Notes" }];
  }

  private static async createAsync(t: TestContext, menus: unknown): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({ [`${ModuleMenusTests.FOLDER}/menus.json`]: JSON.stringify(menus) });
    return repository;
  }

  private static async assertRefusedAsync(repository: RepositoryFixture, menus: unknown, problem: string): Promise<void> {
    await repository.writeAsync({ [`${ModuleMenusTests.FOLDER}/menus.json`]: JSON.stringify(menus) });
    await assert.rejects(ModuleMenus.readAsync(repository.directory, ModuleMenusTests.FOLDER, "notes", ModuleMenusTests.DECLARED),
      new ModuleException(`src/modules/notes/menus.json ${problem}.`));
  }
}

ModuleMenusTests.register();
