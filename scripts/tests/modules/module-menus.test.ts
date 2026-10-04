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
    places: [{ name: "notes.templates", title: "New from template" }, { name: "notes.tools", title: "Notes", shows: "menuBar" }],
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
        places: [{ name: "notes.templates", title: "New from template", shows: "menu" }, { name: "notes.tools", title: "Notes", shows: "menuBar" }],
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

    test("a place that is undeclared, untitled, repeated, missing or with an invalid shows is refused", async t => {
      const repository = await ModuleMenusTests.createAsync(t, ModuleMenusTests.VALID);
      const tools = { name: "notes.tools", title: "Notes" };
      const cases: readonly [unknown, string][] = [
        [[{ name: "notes.templates", title: "T", order: 1 }, tools], "must describe each place with a name, a title and optionally shows"],
        [[{ name: "notes.other", title: "Other" }, tools], "describes the place notes.other, which module.json does not declare in contributes.menus"],
        [[{ name: "notes.templates", title: " " }, tools], "must give the place notes.templates a title"],
        [[{ name: "notes.templates", title: "T", menuBar: true }, tools], "must describe each place with a name, a title and optionally shows"],
        [[{ name: "notes.templates", title: "T", shows: "panel" }, tools], "must give the place notes.templates a shows of menu, menuBar, toolbar"],
        [[{ name: "notes.templates", title: "T", shown: true }, tools], "must give shown, after, before and newRow only to a place that shows as a toolbar, not notes.templates"],
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
        [[{ name: "notes.create", place: "shell.file", items: [item], order: 1 }], "must describe each group with a name, a place, its items or dynamic, and optionally exclusive"],
        [[{ name: "tasks.create", place: "shell.file", items: [item] }], "must name each group \"notes.<name>\", with a camelCase name"],
        [[{ name: "notes.Create", place: "shell.file", items: [item] }], "must name each group \"notes.<name>\", with a camelCase name"],
        [[{ name: "notes.create", place: "file", items: [item] }], "must put the group notes.create in a place named \"<id>.<name>\""],
        [[{ name: "notes.create", place: "shell.file", exclusive: 1, items: [item] }], "must give the group notes.create an exclusive of true or false"],
        [[{ name: "notes.create", place: "shell.file", items: {} }], "must list its items of the group notes.create"],
        [[{ name: "notes.create", place: "shell.file", items: [] }], "must give the group notes.create at least one item"],
        [[{ name: "notes.create", place: "shell.file", dynamic: 1 }], "must give the group notes.create a dynamic of true or false"],
        [[{ name: "notes.create", place: "shell.file", dynamic: true, items: [item] }], "must not give the dynamic group notes.create items, since its window part supplies them"],
        [[{ name: "notes.create", place: "shell.file", items: [item] }, { name: "notes.create", place: "shell.edit", items: [item] }], "names a group more than once"]
      ];

      for (const [groups, problem] of cases)
        await ModuleMenusTests.assertRefusedAsync(repository, { places: ModuleMenusTests.places(), groups }, problem);
    });

    test("an item that is neither a command nor its module's own submenu, or with arguments that are not an object or a blank label, is refused", async t => {
      const repository = await ModuleMenusTests.createAsync(t, ModuleMenusTests.VALID);
      const shape = "must make each item of the group notes.create either a command with optional arguments and label, a submenu, or a choice";
      const cases: readonly [unknown, string][] = [
        [{ command: "notes.newNote", title: "New" }, shape],
        [{ submenu: "notes.templates", command: "notes.newNote" }, shape],
        ["notes.newNote", shape],
        [{ choice: "notes.templates", command: "notes.newNote" }, shape],
        [{ submenu: "tasks.tools" }, "opens tasks.tools as a submenu in the group notes.create, which is not one of its own places"],
        [{ choice: "tasks.tools" }, "opens tasks.tools as a choice in the group notes.create, which is not one of its own places"],
        [{ choice: 1 }, "opens 1 as a choice in the group notes.create, which is not one of its own places"],
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

    test("a toolbar place is read with whether it is shown and the position it prefers, and its choice and dynamic groups are kept", async t => {
      const repository = await ModuleMenusTests.createAsync(t, ModuleMenusTests.VALID);
      const declared = ["notes.main", "notes.view", "notes.display", "notes.tail", "notes.options"];
      const valid = {
        places: [
          { name: "notes.main", title: "Main", shows: "toolbar" },
          { name: "notes.view", title: "View", shows: "toolbar", shown: false, after: "notes.main" },
          { name: "notes.display", title: "Display", shows: "toolbar", before: "notes.main" },
          { name: "notes.tail", title: "Tail", shows: "toolbar", newRow: true },
          { name: "notes.options", title: "Options", shows: "menu" }
        ],
        groups: [
          { name: "notes.create", place: "notes.main", items: [{ command: "notes.newNote" }, { choice: "notes.options" }] },
          { name: "notes.recent", place: "notes.view", dynamic: true }
        ]
      };
      await repository.writeAsync({ [`${ModuleMenusTests.FOLDER}/menus.json`]: JSON.stringify(valid) });

      const menus = await ModuleMenus.readAsync(repository.directory, ModuleMenusTests.FOLDER, "notes", declared);

      assert.deepEqual(menus.toJson(), {
        places: [
          { name: "notes.main", title: "Main", shows: "toolbar", shown: true },
          { name: "notes.view", title: "View", shows: "toolbar", shown: false, after: "notes.main" },
          { name: "notes.display", title: "Display", shows: "toolbar", shown: true, before: "notes.main" },
          { name: "notes.tail", title: "Tail", shows: "toolbar", shown: true, newRow: true },
          { name: "notes.options", title: "Options", shows: "menu" }
        ],
        groups: [
          { name: "notes.create", place: "notes.main", exclusive: false, items: [{ command: "notes.newNote", arguments: {} }, { choice: "notes.options" }] },
          { name: "notes.recent", place: "notes.view", exclusive: false, dynamic: true }
        ]
      });
    });

    test("a toolbar place with an invalid shown, newRow or position, or with more than one position, is refused", async t => {
      const repository = await ModuleMenusTests.createAsync(t, ModuleMenusTests.VALID);
      const tools = { name: "notes.tools", title: "Notes" };
      const toolbar = (fields: Readonly<Record<string, unknown>>): unknown => [{ name: "notes.templates", title: "T", shows: "toolbar", ...fields }, tools];
      const named = "naming another toolbar as \"<id>.<name>\"";
      const cases: readonly [unknown, string][] = [
        [toolbar({ shown: "yes" }), "must give the toolbar notes.templates a shown of true or false"],
        [toolbar({ newRow: 1 }), "must give the toolbar notes.templates a newRow of true or false"],
        [toolbar({ after: "notes.tools", before: "notes.tools" }), "must give the toolbar notes.templates at most one of after, before and newRow"],
        [toolbar({ after: "notes.tools", newRow: true }), "must give the toolbar notes.templates at most one of after, before and newRow"],
        [toolbar({ after: "tools" }), `must give the toolbar notes.templates an after ${named}`],
        [toolbar({ before: 1 }), `must give the toolbar notes.templates an before ${named}`],
        [toolbar({ after: "notes.templates" }), `must give the toolbar notes.templates an after ${named}`]
      ];

      for (const [places, problem] of cases)
        await ModuleMenusTests.assertRefusedAsync(repository, { places, groups: [] }, problem);
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
      await ModuleMenusTests.assertRefusedAsync(repository, {
        places: ModuleMenusTests.places(),
        groups: [{ name: "notes.loop", place: "notes.tools", items: [{ choice: "notes.tools" }] }]
      }, "opens notes.tools inside itself: notes.tools > notes.tools");
    });

    test("a group refers only to places and commands the module may use", async t => {
      const repository = await ModuleMenusTests.createAsync(t, ModuleMenusTests.VALID);
      const menus = await ModuleMenus.readAsync(repository.directory, ModuleMenusTests.FOLDER, "notes", ModuleMenusTests.DECLARED);
      const places = new Set([...ModuleMenus.SHELL_PLACES, ...ModuleMenusTests.DECLARED]);

      menus.checkReferences("notes", places, new Set(), new Set(["notes.newNote", "notes.sortBy"]));

      assert.throws(() => menus.checkReferences("notes", new Set(ModuleMenus.SHELL_PLACES), new Set(), new Set(["notes.newNote", "notes.sortBy"])), new ModuleException(
        "notes's menus.json adds the group notes.sorting to notes.tools, which is neither the shell's place nor its own or a dependency's."));
      assert.throws(() => menus.checkReferences("notes", places, new Set(), new Set(["notes.newNote"])), new ModuleException(
        "notes's menus.json runs notes.sortBy, which neither it nor a module it depends on declares."));
    });

    test("a toolbar stands next to a toolbar of its own or of a dependency, and no toolbar is opened as a menu", async t => {
      const repository = await ModuleMenusTests.createAsync(t, ModuleMenusTests.VALID);
      const declared = ["notes.main", "notes.side", "notes.tools"];
      const read = async (anchors: Readonly<Record<string, unknown>>, groups: readonly unknown[] = []): Promise<ModuleMenus> => {
        const places = [
          { name: "notes.main", title: "Main", shows: "toolbar", ...anchors },
          { name: "notes.side", title: "Side", shows: "toolbar" },
          { name: "notes.tools", title: "Tools", shows: "menu" }
        ];
        await repository.writeAsync({ [`${ModuleMenusTests.FOLDER}/menus.json`]: JSON.stringify({ places, groups }) });
        return await ModuleMenus.readAsync(repository.directory, ModuleMenusTests.FOLDER, "notes", declared);
      };
      const places = new Set([...ModuleMenus.SHELL_PLACES, ...declared, "tasks.bar"]);
      const toolbars = new Set(["notes.main", "notes.side", "tasks.bar"]);
      const commands = new Set(["notes.newNote"]);

      (await read({ after: "notes.side" })).checkReferences("notes", places, toolbars, commands);
      (await read({ before: "tasks.bar" })).checkReferences("notes", places, toolbars, commands);
      await assert.rejects(Promise.resolve().then(async () => (await read({ after: "tasks.gone" })).checkReferences("notes", places, toolbars, commands)), new ModuleException(
        "notes's menus.json puts the toolbar notes.main next to tasks.gone, which is not a toolbar of its own or of a module it depends on."));
      await assert.rejects(Promise.resolve().then(async () => (await read({ before: "notes.tools" })).checkReferences("notes", places, toolbars, commands)), new ModuleException(
        "notes's menus.json puts the toolbar notes.main next to notes.tools, which is not a toolbar of its own or of a module it depends on."));
      for (const [kind, item] of [["submenu", { submenu: "notes.side" }], ["choice", { choice: "notes.side" }]] as const) {
        const group = { name: "notes.open", place: "notes.tools", items: [item] };
        await assert.rejects(Promise.resolve().then(async () => (await read({}, [group])).checkReferences("notes", places, toolbars, commands)), new ModuleException(
          `notes's menus.json opens the toolbar notes.side as a menu in the group notes.open, which a toolbar cannot be.`), kind);
      }
    });

    test("the build checks each module's menus against its own and its dependencies' places and commands", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const module = (id: string, dependencies: readonly string[], contributes: Readonly<Record<string, unknown>>): string =>
        JSON.stringify({ id, displayName: id, description: "Used by the tests.", parts: [], dependencies, contributes });
      const notesMenus = (place: string, command: string, anchor: string = "tasks.bar"): string =>
        JSON.stringify({ places: [{ name: "notes.bar", title: "Bar", shows: "toolbar", after: anchor }], groups: [{ name: "notes.extra", place, items: [{ command }] }] });
      await repository.writeAsync({
        "package.json": JSON.stringify({ teamrun: { modules: ["notes", "tasks", "clock"] } }),
        "src/modules/tasks/module.json": module("tasks", [], { commands: ["tasks.add"], menus: ["tasks.tools", "tasks.bar"] }),
        "src/modules/tasks/menus.json": JSON.stringify({ places: [{ name: "tasks.tools", title: "Tasks", shows: "menuBar" }, { name: "tasks.bar", title: "Bar", shows: "toolbar" }], groups: [] }),
        "src/modules/clock/module.json": module("clock", [], { commands: ["clock.tick"], menus: ["clock.tools", "clock.bar"] }),
        "src/modules/clock/menus.json": JSON.stringify({ places: [{ name: "clock.tools", title: "Clock" }, { name: "clock.bar", title: "Bar", shows: "toolbar" }], groups: [] }),
        "src/modules/notes/module.json": module("notes", ["tasks"], { menus: ["notes.bar"] }),
        "src/modules/notes/menus.json": notesMenus("tasks.tools", "tasks.add")
      });
      const catalog = new ModuleCatalog(repository.directory);

      assert.deepEqual((await catalog.listBuildAsync(false, [])).map(t => t.id), ["tasks", "clock", "notes"]);
      await repository.writeAsync({ "src/modules/notes/menus.json": notesMenus("clock.tools", "tasks.add") });
      await assert.rejects(catalog.listBuildAsync(false, []), /adds the group notes\.extra to clock\.tools/);
      await repository.writeAsync({ "src/modules/notes/menus.json": notesMenus("shell.view", "clock.tick") });
      await assert.rejects(catalog.listBuildAsync(false, []), /runs clock\.tick, which neither it nor a module it depends on declares/);
      await repository.writeAsync({ "src/modules/notes/menus.json": notesMenus("tasks.tools", "tasks.add", "clock.bar") });
      await assert.rejects(catalog.listBuildAsync(false, []), /puts the toolbar notes\.bar next to clock\.bar, which is not a toolbar of its own or of a module it depends on/);
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
