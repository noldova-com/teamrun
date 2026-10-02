/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import {
  BackupVerificationException,
  DataDirectory,
  MigrationException,
  Migration,
  OwnershipLock,
  OwnershipReleasedException,
  PreShellDataException,
  ShellDatabase,
  UnknownSchemaException
} from "@noldova/teamrun-shell-runtime";

import { CorruptDatabaseFixture } from "../../fixtures/corrupt-database.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class ShellDatabaseTests {
  private static readonly MOMENT: Date = new Date("2026-10-01T12:34:56.789Z");
  private static readonly SETTINGS: Migration = new Migration("create-settings", ["CREATE TABLE settings (name TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT"]);
  private static readonly LAYOUT: Migration = new Migration("create-layout", [
    "CREATE TABLE layouts (device TEXT PRIMARY KEY, layout TEXT NOT NULL) STRICT",
    "INSERT INTO settings (name, value) VALUES ('layout', 'created')"
  ]);

  @TestMethod
  public async createsTheDatabaseWithItsHistoryInAnEmptyDirectory(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));

    const database = await ShellDatabase.openAsync(lock, [ShellDatabaseTests.SETTINGS, ShellDatabaseTests.LAYOUT]);
    database.close();
    database.close();

    Assert.areEqual("create-settings,create-layout", database.appliedMigrations.join(","));
    Assert.areEqual("1 create-settings,2 create-layout", ShellDatabaseTests.readHistory(lock.dataDirectory));
    Assert.areEqual("wal", ShellDatabaseTests.query(lock.dataDirectory, "PRAGMA journal_mode", "journal_mode"));
    Assert.isFalse(existsSync(lock.dataDirectory.backupsFolder));
  }

  @TestMethod
  public async backsUpAnExistingDatabaseBeforeApplyingNewMigrations(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    (await ShellDatabase.openAsync(lock, [ShellDatabaseTests.SETTINGS])).close();

    using database = await ShellDatabase.openAsync(lock, [ShellDatabaseTests.SETTINGS, ShellDatabaseTests.LAYOUT], ShellDatabaseTests.MOMENT);

    Assert.areEqual("create-settings,create-layout", database.appliedMigrations.join(","));
    Assert.areEqual("shell-before-migration-2-20261001T123456Z.sqlite", (await readdir(lock.dataDirectory.backupsFolder)).join(","));
    const backup = new DatabaseSync(path.join(lock.dataDirectory.backupsFolder, "shell-before-migration-2-20261001T123456Z.sqlite"), { readOnly: true });
    try {
      Assert.areEqual(1, backup.prepare("SELECT count(*) AS count FROM migration_history").get()?.["count"]);
    }
    finally {
      backup.close();
    }
  }

  @TestMethod
  public async reopensACurrentDatabaseWithoutABackup(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    (await ShellDatabase.openAsync(lock, [ShellDatabaseTests.SETTINGS])).close();

    using database = await ShellDatabase.openAsync(lock, [ShellDatabaseTests.SETTINGS]);

    Assert.areEqual("create-settings", database.appliedMigrations.join(","));
    Assert.isFalse(existsSync(lock.dataDirectory.backupsFolder));
  }

  @TestMethod
  public async refusesAHistoryFromANewerBuild(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    (await ShellDatabase.openAsync(lock, [ShellDatabaseTests.SETTINGS, ShellDatabaseTests.LAYOUT])).close();

    const exception = await Assert.throwsAsync(() => ShellDatabase.openAsync(lock, [ShellDatabaseTests.SETTINGS]), UnknownSchemaException);

    Assert.areEqual("The shell database was written by a newer build.", exception.message);
    Assert.areEqual("1 create-settings,2 create-layout", ShellDatabaseTests.readHistory(lock.dataDirectory));
  }

  @TestMethod
  public async refusesAHistoryThatIsNoPrefixOfTheKnownMigrations(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    (await ShellDatabase.openAsync(lock, [ShellDatabaseTests.SETTINGS])).close();
    const renamed = new Migration("create-preferences", ["CREATE TABLE preferences (name TEXT) STRICT"]);

    const unknown = await Assert.throwsAsync(() => ShellDatabase.openAsync(lock, [renamed, ShellDatabaseTests.LAYOUT]), UnknownSchemaException);
    ShellDatabaseTests.execute(lock.dataDirectory, "UPDATE migration_history SET position = 7");
    const misplaced = await Assert.throwsAsync(() => ShellDatabase.openAsync(lock, [ShellDatabaseTests.SETTINGS]), UnknownSchemaException);

    Assert.areEqual("The shell database's migration history is not one this build recognizes.", unknown.message);
    Assert.areEqual(unknown.message, misplaced.message);
    Assert.isFalse(existsSync(lock.dataDirectory.backupsFolder));
  }

  @TestMethod
  public async refusesTablesWithoutAHistory(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    ShellDatabaseTests.execute(lock.dataDirectory, "CREATE TABLE unknown (value TEXT)");

    const exception = await Assert.throwsAsync(() => ShellDatabase.openAsync(lock, [ShellDatabaseTests.SETTINGS]), UnknownSchemaException);

    Assert.areEqual("The shell database has tables but no migration history.", exception.message);
  }

  @TestMethod
  public async rollsBackAFailedMigrationWithItsHistoryRow(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    const broken = new Migration("create-broken", ["CREATE TABLE half (value TEXT) STRICT", "INSERT INTO missing VALUES (1)"]);

    const exception = await Assert.throwsAsync(() => ShellDatabase.openAsync(lock, [ShellDatabaseTests.SETTINGS, broken]), MigrationException);

    Assert.areEqual("create-broken", exception.migrationId);
    Assert.isInstanceOf(exception.cause, Error);
    Assert.areEqual("1 create-settings", ShellDatabaseTests.readHistory(lock.dataDirectory));
    Assert.isUndefined(ShellDatabaseTests.query(lock.dataDirectory, "SELECT name FROM sqlite_schema WHERE name = 'half'", "name"));
  }

  @TestMethod
  public async refusesPreShellDataWithoutTouchingIt(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    await writeFile(path.join(folder.path, "teamrun.db"), "old records");

    const exception = await Assert.throwsAsync(() => ShellDatabase.openAsync(lock, [ShellDatabaseTests.SETTINGS]), PreShellDataException);

    Assert.areEqual(lock.dataDirectory.root, exception.root);
    Assert.areEqual("teamrun.db", exception.entries.join(","));
    Assert.isFalse(existsSync(lock.dataDirectory.shellDatabase));
  }

  @TestMethod
  public async opensOnlyWhileTheOwnershipIsHeld(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    lock.release();

    await Assert.throwsAsync(() => ShellDatabase.openAsync(lock, []), OwnershipReleasedException);
  }

  @TestMethod
  public async appliesNoMigrationWhenTheBackupFailsVerification(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    await CorruptDatabaseFixture.writeAsync(lock.dataDirectory.shellDatabase);
    ShellDatabaseTests.execute(lock.dataDirectory, "CREATE TABLE migration_history (position INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE) STRICT; INSERT INTO migration_history VALUES (1, 'create-settings')");

    await Assert.throwsAsync(() => ShellDatabase.openAsync(lock, [ShellDatabaseTests.SETTINGS, ShellDatabaseTests.LAYOUT]), BackupVerificationException);

    Assert.areEqual("1 create-settings", ShellDatabaseTests.readHistory(lock.dataDirectory));
    Assert.areEqual(0, (await readdir(lock.dataDirectory.backupsFolder)).length);
  }

  private static readHistory(directory: DataDirectory): string {
    const database = new DatabaseSync(directory.shellDatabase, { readOnly: true });
    try {
      return database.prepare("SELECT position, id FROM migration_history ORDER BY position").all().map(t => `${String(t["position"])} ${String(t["id"])}`).join(",");
    }
    finally {
      database.close();
    }
  }

  private static query(directory: DataDirectory, statement: string, column: string): unknown {
    const database = new DatabaseSync(directory.shellDatabase, { readOnly: true });
    try {
      return database.prepare(statement).get()?.[column];
    }
    finally {
      database.close();
    }
  }

  private static execute(directory: DataDirectory, statements: string): void {
    const database = new DatabaseSync(directory.shellDatabase);
    try {
      database.exec(statements);
    }
    finally {
      database.close();
    }
  }
}
