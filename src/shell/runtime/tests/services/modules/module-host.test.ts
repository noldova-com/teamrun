/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { QualifiedName } from "@noldova/teamrun-shell-protocol";
import { CommandRegistry, DataDirectory, EventRegistry, type IRuntimePart, MethodRegistry, Migration, ModuleDatabase, ModuleDatabaseException, ModuleDeclaration, ModuleHost, NotificationCenter } from "@noldova/teamrun-shell-runtime";

import { RuntimePartFixture } from "../../fixtures/runtime-part.fixture.js";
import { RuntimePartLoaderFixture } from "../../fixtures/runtime-part-loader.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class ModuleHostTests {
  @TestMethod
  public async activatesEachModuleAfterItsDependenciesAndReportsThemInThatOrder(): Promise<void> {
    const log: string[] = [];
    const store = new Map<string, string>([["first", "Write the plan"]]);
    let found: Map<unknown, unknown> | null = null;
    const parts = new Map<string, IRuntimePart>([
      ["notes-runtime", new RuntimePartFixture("notes", log, t => {
        found = t.getService("tasks.store", Map);
      })],
      ["tasks-runtime", new RuntimePartFixture("tasks", log, t => t.publishService("tasks.store", store))]
    ]);
    const host = ModuleHostTests.create([
      ModuleHostTests.declare("notes", ["tasks", "theme"], "notes-runtime"),
      ModuleHostTests.declare("tasks", [], "tasks-runtime"),
      ModuleHostTests.declare("theme", [], null)
    ], parts);

    const before = host.report.modules.length;
    await host.activateAsync();

    Assert.areEqual(0, before);
    Assert.areEqual("activate tasks,activate notes", log.join(","));
    Assert.areEqual<unknown>(store, found);
    Assert.areEqual(
      "{\"modules\":[{\"id\":\"tasks\",\"state\":\"Active\"},{\"id\":\"theme\",\"state\":\"Active\"},{\"id\":\"notes\",\"state\":\"Active\"}]}",
      JSON.stringify(host.report.toJson()));
  }

  @TestMethod
  public async recordsFailuresWithSafeCausesAndBlocksTheirDependents(): Promise<void> {
    const methods = new MethodRegistry();
    const diagnostics = new TextOutputFixture();
    const log: string[] = [];
    const parts = new Map<string, IRuntimePart | Error>([
      ["broken-runtime", new Error("Cannot find module /home/person/secret/broken.js")],
      ["failing-runtime", new RuntimePartFixture("failing", log, t => {
        t.registerMethod("failing.run", { handleAsync: async () => null });
        throw new Error("at /home/person/secret/failing.js:3");
      })]
    ]);
    const host = ModuleHostTests.create([
      ModuleHostTests.declare("broken", [], "broken-runtime"),
      ModuleHostTests.declare("failing", [], "failing-runtime"),
      ModuleHostTests.declare("notes", ["broken"], null),
      ModuleHostTests.declare("orphan", ["missing"], null),
      ModuleHostTests.declare("first", ["second"], null),
      ModuleHostTests.declare("second", ["first"], null)
    ], parts, methods, diagnostics);

    await host.activateAsync();
    await host.deactivateAsync();
    const written = diagnostics.text;

    Assert.areEqual(
      [
        "{\"id\":\"broken\",\"state\":\"Failed\",\"cause\":\"Its runtime part could not be loaded.\"}",
        "{\"id\":\"failing\",\"state\":\"Failed\",\"cause\":\"Its runtime part failed to activate.\"}",
        "{\"id\":\"orphan\",\"state\":\"Blocked\",\"cause\":\"It depends on missing, which is not active.\"}",
        "{\"id\":\"notes\",\"state\":\"Blocked\",\"cause\":\"It depends on broken, which is not active.\"}",
        "{\"id\":\"first\",\"state\":\"Blocked\",\"cause\":\"It depends on second, which is not active.\"}",
        "{\"id\":\"second\",\"state\":\"Blocked\",\"cause\":\"It depends on first, which is not active.\"}"
      ].join(","),
      host.report.modules.map(t => JSON.stringify(t.toJson())).join(","));
    Assert.isUndefined(methods.find(new QualifiedName("failing", "run")));
    Assert.areEqual("activate failing", log.join(","));
    Assert.isTrue(written.startsWith("The module broken: Its runtime part could not be loaded.\nError: Cannot find module /home/person/secret/broken.js\n"), written);
    Assert.isTrue(written.includes("The module failing: Its runtime part failed to activate.\nError: at /home/person/secret/failing.js:3\n"), written);
  }

  @TestMethod
  public async deactivatesInReverseOrderAndWithdrawsEvenWhenAPartFails(): Promise<void> {
    const methods = new MethodRegistry();
    const log: string[] = [];
    const failure = new Error("The notes cannot be saved.");
    const diagnostics = new TextOutputFixture();
    const parts = new Map<string, IRuntimePart>([
      ["tasks-runtime", new RuntimePartFixture("tasks", log, t => t.registerMethod("tasks.list", { handleAsync: async () => [] }))],
      ["notes-runtime", new RuntimePartFixture("notes", log, t => t.registerMethod("notes.list", { handleAsync: async () => [] }), failure)]
    ]);
    const host = ModuleHostTests.create([
      ModuleHostTests.declare("tasks", [], "tasks-runtime", ["tasks.list"]),
      ModuleHostTests.declare("notes", ["tasks"], "notes-runtime", ["notes.list"])
    ], parts, methods, diagnostics);
    await host.activateAsync();

    const exception = await Assert.throwsAsync(() => host.deactivateAsync(), AggregateError);
    await host.deactivateAsync();

    Assert.areEqual("activate tasks,activate notes,deactivate notes,deactivate tasks", log.join(","));
    Assert.areEqual("One or more runtime parts failed to deactivate.", exception.message);
    Assert.areEqual<unknown>(failure, exception.errors[0]);
    Assert.isUndefined(methods.find(new QualifiedName("notes", "list")));
    Assert.isUndefined(methods.find(new QualifiedName("tasks", "list")));
    Assert.isTrue(diagnostics.text.startsWith("The module notes: Its runtime part failed to deactivate.\nError: The notes cannot be saved.\n"));
  }

  @TestMethod
  public async migratesAModulesDatabaseBeforeActivatingItAndClosesItAtDeactivation(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const log: string[] = [];
    const migrations = [new Migration("create-notes", ["CREATE TABLE notes (title TEXT NOT NULL) STRICT"])];
    const notes = new RuntimePartFixture("notes", log, t => t.database.run("INSERT INTO notes (title) VALUES (?)", "Plan"), null, migrations);
    const tasks = new RuntimePartFixture("tasks", log);
    const host = ModuleHostTests.create([
      ModuleHostTests.declare("notes", [], "notes-runtime"),
      ModuleHostTests.declare("tasks", [], "tasks-runtime")
    ], new Map<string, IRuntimePart>([["notes-runtime", notes], ["tasks-runtime", tasks]]), new MethodRegistry(), new TextOutputFixture(), folder.path);

    await host.activateAsync();
    const database = notes.context?.database;
    const missing = Assert.throws(() => tasks.context?.database, ModuleDatabaseException);
    await host.deactivateAsync();

    Assert.isTrue(database instanceof ModuleDatabase);
    Assert.areEqual("The module tasks has no database, because its runtime part declares no migrations.", missing.message);
    Assert.throws(() => database?.readAll("SELECT title FROM notes"), Error);
    using reopened = await ModuleDatabase.openAsync(new DataDirectory(folder.path), "notes", migrations);
    Assert.areEqual("Plan", reopened.read("SELECT title FROM notes")?.["title"]);
    Assert.isFalse(existsSync(new DataDirectory(folder.path).locateModuleDatabase("tasks")));
  }

  @TestMethod
  public async failsAModuleWhoseDatabaseCannotBeMigratedOrIsNewerWithoutActivatingIt(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    (await ModuleDatabase.openAsync(directory, "newer", [
      new Migration("create-items", ["CREATE TABLE items (name TEXT) STRICT"]),
      new Migration("create-tags", ["CREATE TABLE tags (name TEXT) STRICT"])
    ])).close();
    const log: string[] = [];
    const diagnostics = new TextOutputFixture();
    const parts = new Map<string, IRuntimePart>([
      ["broken-runtime", new RuntimePartFixture("broken", log, () => undefined, null, [new Migration("create-broken", ["INSERT INTO missing VALUES (1)"])])],
      ["newer-runtime", new RuntimePartFixture("newer", log, () => undefined, null, [new Migration("create-items", ["CREATE TABLE items (name TEXT) STRICT"])])]
    ]);
    const host = ModuleHostTests.create([
      ModuleHostTests.declare("broken", [], "broken-runtime"),
      ModuleHostTests.declare("newer", [], "newer-runtime")
    ], parts, new MethodRegistry(), diagnostics, folder.path);

    await host.activateAsync();

    Assert.areEqual("", log.join(","));
    Assert.areEqual(
      "{\"modules\":[{\"id\":\"broken\",\"state\":\"Failed\",\"cause\":\"Its database could not be opened or migrated.\"}," +
      "{\"id\":\"newer\",\"state\":\"Failed\",\"cause\":\"Its database was written by a newer build or is not one this build recognizes.\"}]}",
      JSON.stringify(host.report.toJson()));
    Assert.isTrue(diagnostics.text.includes("The migration create-broken of the database of the module broken failed and was rolled back."));
    using kept = await ModuleDatabase.openAsync(directory, "newer", [
      new Migration("create-items", ["CREATE TABLE items (name TEXT) STRICT"]),
      new Migration("create-tags", ["CREATE TABLE tags (name TEXT) STRICT"])
    ]);
    Assert.areEqual("create-items,create-tags", kept.appliedMigrations.join(","));
  }

  @TestMethod
  public async closesTheDatabaseOfAPartThatFailsToActivate(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const migrations = [new Migration("create-notes", ["CREATE TABLE notes (title TEXT NOT NULL) STRICT"])];
    const part = new RuntimePartFixture("notes", [], t => {
      t.database.run("INSERT INTO notes (title) VALUES (?)", "Plan");
      throw new Error("activation failed");
    }, null, migrations);
    const host = ModuleHostTests.create([ModuleHostTests.declare("notes", [], "notes-runtime")], new Map<string, IRuntimePart>([["notes-runtime", part]]),
      new MethodRegistry(), new TextOutputFixture(), folder.path);

    await host.activateAsync();
    const database = part.context?.database;

    Assert.areEqual("Failed", host.report.modules[0]?.state);
    Assert.throws(() => database?.readAll("SELECT title FROM notes"), Error);
  }

  private static declare(id: string, dependencies: readonly string[], runtimePackage: string | null, methods: readonly string[] = []): ModuleDeclaration {
    return new ModuleDeclaration(id, id, dependencies, runtimePackage, new Map([["methods", [...methods, `${id}.run`]]]));
  }

  private static create(
    declarations: readonly ModuleDeclaration[],
    parts: ReadonlyMap<string, IRuntimePart | Error>,
    methods: MethodRegistry = new MethodRegistry(),
    diagnostics: TextOutputFixture = new TextOutputFixture(),
    root: string = path.resolve("teamrun-data")): ModuleHost {
    return new ModuleHost(
      declarations,
      new DataDirectory(root),
      methods,
      new EventRegistry({ broadcast: () => undefined }),
      new CommandRegistry(),
      new NotificationCenter(() => undefined, () => new Date()),
      new RuntimePartLoaderFixture(parts),
      diagnostics);
  }
}
