/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DataDirectory, Migration, MigrationException, ModuleDatabase, UnknownSchemaException } from "@noldova/teamrun-shell-runtime";

import { ModuleDatabaseFixture } from "../../fixtures/module-database.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class ModuleDatabaseTests {
  private static readonly MOMENT: Date = new Date("2026-10-02T08:09:10.111Z");
  private static readonly TAGS: Migration = new Migration("create-tags", ["CREATE TABLE tags (note INTEGER NOT NULL, tag TEXT NOT NULL) STRICT"]);

  @TestMethod
  public async createsTheDatabaseInTheModulesFolderAndReopensItWithItsData(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);

    const created = await ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES]);
    const inserted = created.run("INSERT INTO notes (title) VALUES (?)", "Plan");
    created.close();
    using reopened = await ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES]);

    Assert.areEqual(path.join(folder.path, "modules", "notes", "notes.sqlite"), directory.locateModuleDatabase("notes"));
    Assert.isTrue(existsSync(directory.locateModuleDatabase("notes")));
    Assert.areEqual(1, Number(inserted.changes));
    Assert.areEqual(1, Number(inserted.lastInsertRowid));
    Assert.areEqual("create-notes", reopened.appliedMigrations.join(","));
    Assert.areEqual("Plan", reopened.read("SELECT title FROM notes")?.["title"]);
    Assert.isFalse(existsSync(directory.backupsFolder));
  }

  @TestMethod
  public async backsUpBeforeApplyingNewMigrationsUnderTheModulesName(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    (await ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES])).close();

    using database = await ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES, ModuleDatabaseTests.TAGS], ModuleDatabaseTests.MOMENT);

    Assert.areEqual("create-notes,create-tags", database.appliedMigrations.join(","));
    Assert.areEqual("notes-before-migration-2-20261002T080910Z.sqlite", (await readdir(directory.backupsFolder)).join(","));
  }

  @TestMethod
  public async refusesADatabaseFromANewerBuildWithoutChangingIt(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    (await ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES, ModuleDatabaseTests.TAGS])).close();

    const exception = await Assert.throwsAsync(() => ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES]), UnknownSchemaException);

    Assert.areEqual("The database of the module notes was written by a newer build.", exception.message);
    Assert.areEqual("1 create-notes,2 create-tags", ModuleDatabaseTests.readHistory(directory.locateModuleDatabase("notes")));
  }

  @TestMethod
  public async rollsBackAFailedMigrationAndKeepsTheEarlierOnes(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    const broken = new Migration("create-broken", ["CREATE TABLE half (value TEXT) STRICT", "INSERT INTO missing VALUES (1)"]);

    const exception = await Assert.throwsAsync(() => ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES, broken]), MigrationException);

    Assert.areEqual("The migration create-broken of the database of the module notes failed and was rolled back.", exception.message);
    Assert.areEqual("1 create-notes", ModuleDatabaseTests.readHistory(directory.locateModuleDatabase("notes")));
  }

  @TestMethod
  public async keepsEachModulesDataInItsOwnDatabase(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    using notes = await ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES]);
    using tasks = await ModuleDatabase.openAsync(directory, "tasks", [new Migration("create-notes", ["CREATE TABLE notes (id INTEGER PRIMARY KEY, title TEXT NOT NULL) STRICT"])]);

    notes.run("INSERT INTO notes (title) VALUES (?)", "Only in notes");

    Assert.areEqual(1, notes.readAll("SELECT title FROM notes").length);
    Assert.areEqual(0, tasks.readAll("SELECT title FROM notes").length);
    Assert.areNotEqual(directory.locateModuleDatabase("notes"), directory.locateModuleDatabase("tasks"));
  }

  private static readHistory(file: string): string {
    const database = new DatabaseSync(file, { readOnly: true });
    try {
      return database.prepare("SELECT position, id FROM migration_history ORDER BY position").all().map(t => `${String(t["position"])} ${String(t["id"])}`).join(",");
    }
    finally {
      database.close();
    }
  }
}
