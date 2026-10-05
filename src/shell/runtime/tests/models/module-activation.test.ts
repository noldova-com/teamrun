/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { existsSync } from "node:fs";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DataDirectory, type IRuntimePart, MethodRegistry, Migration, ModuleDatabase, ModuleDatabaseException } from "@noldova/teamrun-shell-runtime";

import { ModuleHostFixture } from "../fixtures/module-host.fixture.js";
import { RuntimePartFixture } from "../fixtures/runtime-part.fixture.js";
import { SettingsFixture } from "../fixtures/settings.fixture.js";
import { TemporaryFolderFixture } from "../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../fixtures/text-output.fixture.js";

@TestClass
export class ModuleActivationTests {
  @TestMethod
  public async migratesAModulesDatabaseBeforeActivatingItAndClosesItAtDeactivation(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const log: string[] = [];
    const migrations = [new Migration("create-notes", ["CREATE TABLE notes (title TEXT NOT NULL) STRICT"])];
    const notes = new RuntimePartFixture("notes", log, t => t.database.run("INSERT INTO notes (title) VALUES (?)", "Plan"), null, migrations);
    const tasks = new RuntimePartFixture("tasks", log);
    const host = ModuleHostFixture.create([
      ModuleHostFixture.declare("notes", [], "notes-runtime"),
      ModuleHostFixture.declare("tasks", [], "tasks-runtime")
    ], new Map<string, IRuntimePart>([["notes-runtime", notes], ["tasks-runtime", tasks]]), new MethodRegistry(), new TextOutputFixture(), folder.path);

    await host.activateAsync(settings.service, settings.processes);
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
}
