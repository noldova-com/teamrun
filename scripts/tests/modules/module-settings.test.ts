/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ModuleException from "../../modules/module.exception.ts";
import ModuleSettings from "../../modules/module-settings.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class ModuleSettingsTests {
  private static readonly FOLDER: string = "src/modules/notes";
  private static readonly FILE: string = "src/modules/notes/settings.json";
  private static readonly SORT: Readonly<Record<string, unknown>> = {
    name: "notes.sortBy",
    title: "Sort by",
    description: "Orders the list.",
    type: { kind: "Choice", options: [{ value: "title", title: "Title" }, { value: "date", title: "Date" }] },
    default: "title",
    locality: "Shared",
    scopes: ["notes.folder", "tasks.list"],
    page: "Notes",
    group: "List"
  };
  private static readonly FIELDS: string = "must have exactly the fields name, title, description, type, default, locality, scopes, page, group";
  private static readonly SCOPES: string = "must list distinct scopes, each one its module declares among its settingScopes or a dependency's, and none for a device setting";
  private static readonly TEMPLATES: Readonly<Record<string, unknown>> = { kind: "Action", command: "notes.openTemplates", label: "Open templates" };
  private static readonly CONTRIBUTIONS: ReadonlyMap<string, readonly string[]> = new Map([
    ["settings", ["notes.sortBy"]],
    ["settingScopes", ["notes.folder"]],
    ["commands", ["notes.openTemplates"]]
  ]);

  public static register(): void {
    test("a module's settings are read with every kind of type, and a module without settings needs no file", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const settings = [
        ModuleSettingsTests.SORT,
        ModuleSettingsTests.setting("notes.wrap", { kind: "Boolean" }, false, "Device"),
        ModuleSettingsTests.setting("notes.size", { kind: "Number", minimum: 10, maximum: 20, step: 0.1 }, 10.3, "Device"),
        ModuleSettingsTests.setting("notes.prefix", { kind: "Text", maxLength: 3 }, "abc", "Shared"),
        ModuleSettingsTests.setting("notes.hidden", { kind: "Modules" }, ["tasks", "clock"], "Shared"),
        ModuleSettingsTests.setting("notes.templates", ModuleSettingsTests.TEMPLATES, null, "Shared")
      ];
      const names = settings.map(t => String(t["name"]));

      const none = await ModuleSettings.readAsync(repository.directory, ModuleSettingsTests.FOLDER, [], new Map());
      await repository.writeAsync({ [ModuleSettingsTests.FILE]: JSON.stringify({ settings }) });
      const read = await ModuleSettings.readAsync(repository.directory, ModuleSettingsTests.FOLDER, ["tasks"], new Map([["settings", names], ["settingScopes", ["notes.folder"]], ["commands", ["notes.openTemplates"]]]));

      assert.deepEqual(none, []);
      assert.deepEqual(read, settings);
    });

    test("a missing, unreadable or malformed file and settings that differ from those declared are refused", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const read = (): Promise<unknown> => ModuleSettings.readAsync(repository.directory, ModuleSettingsTests.FOLDER, ["tasks"], ModuleSettingsTests.CONTRIBUTIONS);

      await assert.rejects(read(), new ModuleException(`${ModuleSettingsTests.FOLDER}/module.json declares settings, but ${ModuleSettingsTests.FILE} is missing.`));
      await repository.writeAsync({ [ModuleSettingsTests.FILE]: "{" });
      await assert.rejects(read(), new ModuleException(`${ModuleSettingsTests.FILE} could not be read as JSON.`));
      for (const text of ["[]", "{\"settings\":{}}", "{\"settings\":[],\"other\":1}"]) {
        await repository.writeAsync({ [ModuleSettingsTests.FILE]: text });
        await assert.rejects(read(), new ModuleException(`${ModuleSettingsTests.FILE} must be an object whose only field, "settings", lists the module's settings.`));
      }
      const other = { ...ModuleSettingsTests.SORT, name: "notes.other" };
      for (const settings of [[], [ModuleSettingsTests.SORT, ModuleSettingsTests.SORT], [ModuleSettingsTests.SORT, other]]) {
        await repository.writeAsync({ [ModuleSettingsTests.FILE]: JSON.stringify({ settings }) });
        await assert.rejects(read(), new ModuleException(`${ModuleSettingsTests.FILE} must define each setting that module.json declares, once, and no other.`));
      }
    });

    test("a definition with other fields, blank texts, a default its type refuses, an unknown locality or scopes it may not use is refused", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const withoutType = Object.fromEntries(Object.entries(ModuleSettingsTests.SORT).filter(([field]) => field !== "type"));
      const cases: readonly (readonly [unknown, string])[] = [
        ["notes.sortBy", ModuleSettingsTests.FIELDS],
        [withoutType, ModuleSettingsTests.FIELDS],
        [{ ...ModuleSettingsTests.SORT, extra: 1 }, ModuleSettingsTests.FIELDS],
        [{ ...ModuleSettingsTests.SORT, title: " " }, "must have a title, description, page and group that are not blank"],
        [{ ...ModuleSettingsTests.SORT, group: 1 }, "must have a title, description, page and group that are not blank"],
        [{ ...ModuleSettingsTests.SORT, default: "size" }, "must have a default its type accepts"],
        [{ ...ModuleSettingsTests.SORT, locality: "Cloud" }, "must have the locality Device or Shared"],
        [{ ...ModuleSettingsTests.SORT, locality: 1 }, "must have the locality Device or Shared"],
        [{ ...ModuleSettingsTests.SORT, scopes: "notes.folder" }, ModuleSettingsTests.SCOPES],
        [{ ...ModuleSettingsTests.SORT, scopes: [1] }, ModuleSettingsTests.SCOPES],
        [{ ...ModuleSettingsTests.SORT, scopes: ["clock.dial"] }, ModuleSettingsTests.SCOPES],
        [{ ...ModuleSettingsTests.SORT, scopes: ["notes.folder", "notes.folder"] }, ModuleSettingsTests.SCOPES],
        [{ ...ModuleSettingsTests.SORT, locality: "Device" }, ModuleSettingsTests.SCOPES]
      ];

      for (const [setting, problem] of cases)
        await ModuleSettingsTests.assertRefusedAsync(repository, setting, problem);
    });

    test("a type of an unknown kind, with other fields or limits that make no type is refused", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const kind = "must have a type of kind Boolean, Choice, Number, Text, Modules or Action, with exactly that kind's fields";
      const action = "must have an action type whose command is one its module declares and whose label is not blank";
      const choice = "must have a choice type with options, each with a distinct value and a title, none blank";
      const number = "must have a number type whose minimum is no greater than its maximum and whose step is positive";
      const cases: readonly (readonly [unknown, string])[] = [
        [null, kind],
        [{ kind: 1 }, kind],
        [{ kind: "Color" }, kind],
        [{ kind: "Boolean", options: [] }, kind],
        [{ kind: "Number", minimum: 1, maximum: 2 }, kind],
        [{ kind: "Choice", options: "title" }, choice],
        [{ kind: "Choice", options: [] }, choice],
        [{ kind: "Choice", options: [{ value: "title" }] }, choice],
        [{ kind: "Choice", options: [{ value: " ", title: "Blank" }] }, choice],
        [{ kind: "Choice", options: [{ value: "title", title: "Title" }, { value: "title", title: "Again" }] }, choice],
        [{ kind: "Number", minimum: "1", maximum: 2, step: 1 }, number],
        [{ kind: "Number", minimum: 1, maximum: Number.POSITIVE_INFINITY, step: 1 }, number],
        [{ kind: "Number", minimum: 3, maximum: 2, step: 1 }, number],
        [{ kind: "Number", minimum: 1, maximum: 2, step: 0 }, number],
        [{ kind: "Text", maxLength: 0 }, "must have a text type whose maxLength is a positive integer"],
        [{ kind: "Text", maxLength: 1.5 }, "must have a text type whose maxLength is a positive integer"],
        [{ kind: "Action", command: "notes.openTemplates" }, kind],
        [{ ...ModuleSettingsTests.TEMPLATES, command: "notes.sortBy" }, action],
        [{ ...ModuleSettingsTests.TEMPLATES, command: 1 }, action],
        [{ ...ModuleSettingsTests.TEMPLATES, label: " " }, action]
      ];

      for (const [type, problem] of cases)
        await ModuleSettingsTests.assertRefusedAsync(repository, { ...ModuleSettingsTests.SORT, type }, problem);
      await ModuleSettingsTests.assertRefusedAsync(repository, { ...ModuleSettingsTests.SORT, type: ModuleSettingsTests.TEMPLATES }, action, new Map([["settings", ["notes.sortBy"]]]));
    });

    test("a default outside its number, text, modules or action type is refused", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const refused = "must have a default its type accepts";
      const cases: readonly (readonly [unknown, unknown])[] = [
        [{ kind: "Boolean" }, "true"],
        [{ kind: "Number", minimum: 10, maximum: 20, step: 2 }, 11],
        [{ kind: "Number", minimum: 10, maximum: 20, step: 2 }, 22],
        [{ kind: "Number", minimum: 10, maximum: 20, step: 2 }, 8],
        [{ kind: "Number", minimum: 10, maximum: 20, step: 2 }, "12"],
        [{ kind: "Text", maxLength: 3 }, "abcd"],
        [{ kind: "Text", maxLength: 3 }, 1],
        [{ kind: "Modules" }, "tasks"],
        [{ kind: "Modules" }, ["tasks", "tasks"]],
        [{ kind: "Modules" }, [" "]],
        [ModuleSettingsTests.TEMPLATES, false]
      ];

      for (const [type, value] of cases)
        await ModuleSettingsTests.assertRefusedAsync(repository, { ...ModuleSettingsTests.SORT, type, default: value, scopes: [] }, refused);
    });
  }

  private static setting(name: string, type: Readonly<Record<string, unknown>>, value: unknown, locality: string): Readonly<Record<string, unknown>> {
    return { ...ModuleSettingsTests.SORT, name, type, default: value, locality, scopes: [] };
  }

  private static async assertRefusedAsync(
    repository: RepositoryFixture,
    setting: unknown,
    problem: string,
    contributions: ReadonlyMap<string, readonly string[]> = ModuleSettingsTests.CONTRIBUTIONS
  ): Promise<void> {
    await repository.writeAsync({ [ModuleSettingsTests.FILE]: JSON.stringify({ settings: [setting] }) });
    await assert.rejects(ModuleSettings.readAsync(repository.directory, ModuleSettingsTests.FOLDER, ["tasks"], contributions),
      new ModuleException(`${ModuleSettingsTests.FILE} settings[0] ${problem}.`));
  }
}

ModuleSettingsTests.register();
