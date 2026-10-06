/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import ModuleCliCommands from "../../modules/module-cli-commands.ts";
import ModuleException from "../../modules/module.exception.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class ModuleCliCommandsTests {
  private static readonly FOLDER: string = "src/modules/notes";
  private static readonly FILE: string = "src/modules/notes/cli.json";
  private static readonly CONTRIBUTIONS: ReadonlyMap<string, readonly string[]> = new Map([["cliCommands", ["notes.addNote"]]]);
  private static readonly ADD: Readonly<Record<string, unknown>> = { name: "notes.addNote", summary: "Adds a note.", arguments: [], options: [] };
  private static readonly COMMAND_FIELDS: string = "must be an object with the fields name, summary, arguments, options, and optionally description, examples";

  public static register(): void {
    test("a module's command-line commands are read with their defaults filled in, and a module without them needs no file", async t => {
      const repository = await ModuleCliCommandsTests.createAsync(t);
      const add = {
        name: "notes.addNote",
        summary: "Adds a note.",
        description: "Adds a note to the notebook and prints its id.",
        arguments: [
          { name: "title", description: "The note's title." },
          { name: "tags", description: "Its tags.", required: false, variadic: true }
        ],
        options: [
          { name: "pinned", description: "Pins the note.", type: "Boolean" },
          { name: "folder", description: "Its folder.", type: "Text", default: "Inbox" },
          { name: "priority", description: "Its priority.", type: "Number", required: true },
          { name: "linkTo", description: "Notes it links to.", type: "Number", repeated: true },
          { name: "author", description: "Who wrote it.", type: "Text", required: false, repeated: false }
        ],
        examples: [{ arguments: "Plan --priority 2", description: "Adds the note Plan." }]
      };
      const list = { name: "notes.listNotes", summary: "Lists the notes.", arguments: [{ name: "folder", description: "The folder.", required: true, variadic: false }], options: [] };

      const none = await ModuleCliCommands.readAsync(repository.directory, ModuleCliCommandsTests.FOLDER, new Map());
      await repository.writeAsync({ [ModuleCliCommandsTests.FILE]: JSON.stringify({ commands: [add, list] }) });
      const read = await ModuleCliCommands.readAsync(repository.directory, ModuleCliCommandsTests.FOLDER, new Map([["cliCommands", ["notes.listNotes", "notes.addNote"]]]));

      assert.deepEqual(none, []);
      assert.deepEqual(read, [
        {
          ...add,
          arguments: [
            { name: "title", description: "The note's title.", required: true, variadic: false },
            { name: "tags", description: "Its tags.", required: false, variadic: true }
          ],
          options: [
            { name: "pinned", description: "Pins the note.", type: "Boolean", required: false, repeated: false, default: null },
            { name: "folder", description: "Its folder.", type: "Text", required: false, repeated: false, default: "Inbox" },
            { name: "priority", description: "Its priority.", type: "Number", required: true, repeated: false, default: null },
            { name: "linkTo", description: "Notes it links to.", type: "Number", required: false, repeated: true, default: null },
            { name: "author", description: "Who wrote it.", type: "Text", required: false, repeated: false, default: null }
          ]
        },
        { ...list, description: null, examples: [] }
      ]);
    });

    test("a missing, unreadable or malformed file and commands that differ from those declared are refused", async t => {
      const repository = await ModuleCliCommandsTests.createAsync(t);
      const read = (): Promise<unknown> => ModuleCliCommands.readAsync(repository.directory, ModuleCliCommandsTests.FOLDER, ModuleCliCommandsTests.CONTRIBUTIONS);

      await assert.rejects(read(), new ModuleException(`${ModuleCliCommandsTests.FOLDER}/module.json declares command-line commands, but ${ModuleCliCommandsTests.FILE} is missing.`));
      await repository.writeAsync({ [ModuleCliCommandsTests.FILE]: "{" });
      await assert.rejects(read(), new ModuleException(`${ModuleCliCommandsTests.FILE} could not be read as JSON.`));
      for (const text of ["[]", "{\"commands\":{}}", "{\"commands\":[],\"other\":1}"]) {
        await repository.writeAsync({ [ModuleCliCommandsTests.FILE]: text });
        await assert.rejects(read(), new ModuleException(`${ModuleCliCommandsTests.FILE} must be an object whose only field, "commands", lists the module's command-line commands.`));
      }
      const other = { ...ModuleCliCommandsTests.ADD, name: "notes.other" };
      for (const commands of [[], [ModuleCliCommandsTests.ADD, ModuleCliCommandsTests.ADD], [ModuleCliCommandsTests.ADD, other]]) {
        await repository.writeAsync({ [ModuleCliCommandsTests.FILE]: JSON.stringify({ commands }) });
        await assert.rejects(read(), new ModuleException(`${ModuleCliCommandsTests.FILE} must define each command-line command that module.json declares, once, and no other.`));
      }
    });

    test("a command with other or missing fields, blank texts or lists that are not lists is refused", async t => {
      const repository = await ModuleCliCommandsTests.createAsync(t);
      const add = ModuleCliCommandsTests.ADD;

      for (const command of [null, [], { ...add, title: "Add" }, { name: "notes.addNote", summary: "Adds a note.", options: [] }])
        await ModuleCliCommandsTests.assertRefusedAsync(repository, command, ModuleCliCommandsTests.COMMAND_FIELDS);
      for (const command of [{ ...add, name: 1 }, { ...add, summary: " " }])
        await ModuleCliCommandsTests.assertRefusedAsync(repository, command, "must have a name and a summary that are not blank");
      await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, description: " " }, "must have a description that is not blank, or none");
      await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, arguments: {} }, "must list its arguments");
      await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, options: "none" }, "must list its options");
      await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, examples: {} }, "must list its examples");
    });

    test("an argument, option or example with other fields, an invalid name, type or flag, or a default it may not have is refused", async t => {
      const repository = await ModuleCliCommandsTests.createAsync(t);
      const add = ModuleCliCommandsTests.ADD;
      const title = { name: "title", description: "The title." };
      const folder = { name: "folder", description: "The folder.", type: "Text" };
      const named = "must have a camelCase name and a description that is not blank";

      await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, arguments: [{ ...title, type: "Text" }] },
        "arguments[0] must be an object with the fields name, description, and optionally required, variadic");
      for (const argument of [{ ...title, name: "Title" }, { ...title, name: "the-title" }, { ...title, description: "" }])
        await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, arguments: [argument] }, `arguments[0] ${named}`);
      for (const argument of [{ ...title, required: "yes" }, { ...title, variadic: 1 }])
        await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, arguments: [argument] }, "arguments[0] must have a required and a variadic that are true or false");

      for (const option of [null, { ...folder, type: "Choice" }, { name: "folder", description: "The folder." }])
        await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, options: [{ ...folder, type: "Boolean" }, option] }, "options[1] must have the type Text, Number or Boolean");
      await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, options: [{ ...folder, type: "Boolean", default: false }] },
        "options[0] must be an object with the fields name, description, type");
      await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, options: [{ ...folder, values: [] }] },
        "options[0] must be an object with the fields name, description, type, and optionally required, repeated, default");
      for (const option of [{ ...folder, name: "Folder" }, { ...folder, type: "Boolean", description: " " }])
        await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, options: [option] }, `options[0] ${named}`);
      for (const option of [{ ...folder, required: 1 }, { ...folder, repeated: "no" }])
        await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, options: [option] }, "options[0] must have a required and a repeated that are true or false");
      for (const option of [{ ...folder, default: 1 }, { ...folder, type: "Number", default: "1" }, { ...folder, required: true, default: "Inbox" }, { ...folder, repeated: true, default: "Inbox" }])
        await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, options: [option] }, "options[0] must have a default its type accepts, or none, and none when it is required or repeated");

      await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, examples: [{ arguments: "Plan" }] }, "examples[0] must be an object with the fields arguments, description");
      for (const example of [{ arguments: 1, description: "Adds Plan." }, { arguments: "Plan", description: " " }])
        await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, examples: [example] }, "examples[0] must have arguments as text and a description that is not blank");
    });

    test("a repeated name, a required argument after an optional one, a variadic argument before the last and an option the command line has itself are refused", async t => {
      const repository = await ModuleCliCommandsTests.createAsync(t);
      const add = ModuleCliCommandsTests.ADD;
      const title = { name: "title", description: "The title." };
      const tags = { name: "tags", description: "The tags.", required: false, variadic: true };
      const option = (name: string): Readonly<Record<string, unknown>> => ({ name, description: "An option.", type: "Boolean" });

      await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, arguments: [title, { ...title, required: false }] }, "must name each of its arguments and options once");
      await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, arguments: [title], options: [option("title")] }, "must name each of its arguments and options once");
      await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, arguments: [{ ...title, required: false }, { name: "body", description: "The body." }] },
        "must not have a required argument after an optional one");
      await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, arguments: [tags, { name: "body", description: "The body.", required: false }] },
        "must have only its last argument variadic");
      await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, options: [option("dataDir"), option("verbose"), option("help"), option("noStart")] },
        "must not have options the command line has itself: --data-dir, --help, --no-start");
      for (const name of ["deviceDir", "json", "takeOver", "timeout", "argsFile"])
        await ModuleCliCommandsTests.assertRefusedAsync(repository, { ...add, options: [option(name)] }, `must not have options the command line has itself: --${name.replace(/[A-Z]/g, t => `-${t.toLowerCase()}`)}`);
    });
  }

  private static async createAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    return repository;
  }

  private static async assertRefusedAsync(repository: RepositoryFixture, command: unknown, problem: string): Promise<void> {
    await repository.writeAsync({ [ModuleCliCommandsTests.FILE]: JSON.stringify({ commands: [command] }) });
    await assert.rejects(ModuleCliCommands.readAsync(repository.directory, ModuleCliCommandsTests.FOLDER, ModuleCliCommandsTests.CONTRIBUTIONS),
      new ModuleException(`${ModuleCliCommandsTests.FILE} commands[0] ${problem}.`));
  }
}

ModuleCliCommandsTests.register();
