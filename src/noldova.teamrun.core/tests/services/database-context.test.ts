/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { ChangeOperation, DbContext, DbContextOptionsBuilder } from "@noldova/context.data";
import { SqlChangeFeed, SqlQuery } from "@noldova/context.data.sql";
import { SQLiteConnection } from "@noldova/context.data.sql.sqlite";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChangeEntity, DatabaseContext, MigrationCatalog, Resources } from "@noldova/teamrun.core";
import { ErrorCode } from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";

import { TemporaryDataDirectory } from "../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class DatabaseContextTests {
  private static readonly EARLIER: string = "2026-11-01T00:00:00.000Z";
  private static readonly KEPT: string = "{\"kept\":true}";
  private static readonly SYNCHRONOUS_FULL: number = 2;
  private static readonly SELECT_SCHEMA: string =
    "SELECT sql FROM sqlite_master AS t WHERE sql IS NOT NULL AND tbl_name NOT IN ('__migrations', '__changes', 'sqlite_sequence') "
    + "AND NOT EXISTS (SELECT 1 FROM sqlite_master AS v WHERE v.sql LIKE 'CREATE VIRTUAL TABLE %' AND substr(t.name, 1, length(v.name) + 1) = v.name || '_') "
    + "ORDER BY rowid";
  private static readonly EARLIER_STATEMENTS: readonly string[] = [
    "PRAGMA journal_mode = WAL",
    "CREATE TABLE IF NOT EXISTS __migrations (id TEXT PRIMARY KEY, appliedAt TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS __changes (sequence INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT NOT NULL, entityId TEXT NOT NULL, operation TEXT NOT NULL, payload TEXT NOT NULL, createdAt TEXT NOT NULL)",
    "CREATE INDEX IF NOT EXISTS IX___changes_entity_entityId ON __changes (entity, entityId)"
  ];

  private static async readSchemaAsync(directory: string): Promise<readonly string[]> {
    await using context = await DatabaseContext.openAsync(directory);
    return (await context.database.connection.queryAsync(new SqlQuery(DatabaseContextTests.SELECT_SCHEMA))).map(t => t.readString("sql").replaceAll("\"", ""));
  }

  private static writeEarlierDatabase(directory: string, schema: readonly string[]): void {
    const database = new DatabaseSync(join(directory, Resources.databaseFileName));
    try {
      for (const statement of [...DatabaseContextTests.EARLIER_STATEMENTS, ...schema])
        database.exec(statement);
      for (const migration of MigrationCatalog.all)
        database.prepare("INSERT INTO __migrations (id, appliedAt) VALUES (?, ?)").run(migration.id, DatabaseContextTests.EARLIER);
      database.prepare("INSERT INTO preferences (name, json, updatedAt) VALUES (?, ?, ?)").run("kept", DatabaseContextTests.KEPT, DatabaseContextTests.EARLIER);
      database.prepare("INSERT INTO __changes (entity, entityId, operation, payload, createdAt) VALUES (?, ?, ?, ?, ?)")
        .run(ChangeEntity.Preference, "kept", ChangeOperation.Update, DatabaseContextTests.KEPT, DatabaseContextTests.EARLIER);
    }
    finally {
      database.close();
    }
  }

  @TestMethod
  public async opensADatabaseTheEarlierDataPackagesWroteWithoutReapplyingItsMigrations(): Promise<void> {
    using schemaDirectory = new TemporaryDataDirectory();
    using directory = new TemporaryDataDirectory();
    const schema = await DatabaseContextTests.readSchemaAsync(schemaDirectory.path);
    Assert.isTrue(schema.length > 0);
    Assert.isFalse(schema.some(t => t.includes("\"")));
    DatabaseContextTests.writeEarlierDatabase(directory.path, schema);

    await using context = await DatabaseContext.openAsync(directory.path);
    const changes = await context.database.changeFeed.readAfterAsync(0);
    const json = (await context.database.connection.queryAsync(new SqlQuery(Resources.selectPreference, ["kept"])))[0]?.readString(Resources.jsonColumn);
    const recorded = (await context.database.connection.queryAsync(new SqlQuery("SELECT COUNT(*) AS count FROM __migrations WHERE appliedAt = ?", [DatabaseContextTests.EARLIER])))[0]?.readInteger("count");

    Assert.areEqual(MigrationCatalog.all.map(t => t.id).join(","), (await context.database.getAppliedMigrationsAsync()).join(","));
    Assert.areEqual(0, (await context.database.getPendingMigrationsAsync()).length);
    Assert.areEqual(MigrationCatalog.all.length, recorded);
    Assert.areEqual(DatabaseContextTests.KEPT, json);
    Assert.areEqual(JSON.stringify([[1, ChangeEntity.Preference, "kept", ChangeOperation.Update, DatabaseContextTests.KEPT]]),
      JSON.stringify(changes.map(t => [t.sequence, t.entity, t.entityId, t.operation, t.payload])));
    Assert.areEqual(2, (await context.database.changeFeed.appendAsync(ChangeEntity.Preference, "kept", ChangeOperation.Update, "{}")).sequence);
  }

  @TestMethod
  public async opensTheDatabaseFileWithTheSchemaCurrent(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const nested = join(directory.path, "nested");
    await using context = await DatabaseContext.openAsync(nested);

    Assert.isInstanceOf(context, DbContext);
    Assert.isTrue(existsSync(join(nested, "teamrun.db")));
    Assert.isInstanceOf(context.database.connection, SQLiteConnection);
    Assert.areEqual("teamrun", context.database.connection.dataSource.name);
    Assert.isTrue(context.database.connection.isOpen);
    Assert.areEqual(Resources.initialMigrationId, (await context.database.getAppliedMigrationsAsync())[0]);
    Assert.areEqual(0, (await context.database.getPendingMigrationsAsync()).length);
    Assert.isInstanceOf(context.database.changeFeed, SqlChangeFeed);
    Assert.areEqual(1, (await context.database.changeFeed.appendAsync(ChangeEntity.Project, "prj-1", ChangeOperation.Insert, "{}")).sequence);
  }

  @TestMethod
  public async flushesEveryCommitToDiskBeforeItReturns(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);

    const rows = await context.database.connection.queryAsync(new SqlQuery("PRAGMA synchronous"));

    Assert.areEqual(DatabaseContextTests.SYNCHRONOUS_FULL, rows[0]?.readInteger("synchronous"));
  }

  @TestMethod
  public async rejectsABlankDataDirectory(): Promise<void> {
    await Assert.throwsAsync(() => DatabaseContext.openAsync(" "), ArgumentException);
  }

  @TestMethod
  public async reopensAnExistingDataDirectoryWithoutReapplyingMigrations(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    {
      await using context = await DatabaseContext.openAsync(directory.path);
      await context.database.changeFeed.appendAsync(ChangeEntity.Project, "prj-1", ChangeOperation.Insert, "{}");
    }
    await using reopened = await DatabaseContext.openAsync(directory.path);

    Assert.areEqual(1, (await reopened.database.changeFeed.readAfterAsync(0)).length);
    Assert.areEqual(MigrationCatalog.all.length, (await reopened.database.getAppliedMigrationsAsync()).length);
  }

  @TestMethod
  public async attachesToADatabaseWithoutMigratingItAndRejectsABlankDataDirectory(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const options = new DbContextOptionsBuilder().useSQLite(join(directory.path, "hosted.sqlite"));
    await using context = DatabaseContext.attach(options, directory.path);

    Assert.areEqual(directory.path, context.dataDirectory);
    Assert.areEqual("hosted", context.database.connection.dataSource.name);
    Assert.areEqual(MigrationCatalog.all.length, (await context.database.getPendingMigrationsAsync()).length);
    Assert.throws(() => DatabaseContext.attach(options, " "), ArgumentException);
  }

  @TestMethod
  public async refusesANewerOrDifferentMigrationHistory(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    await context.database.connection.executeAsync(new SqlQuery("INSERT INTO __migrations (id,appliedAt) VALUES ('9999-future','t')"));
    Assert.areEqual(ErrorCode.VersionMismatch, (await Assert.throwsAsync(() => DatabaseContext.openAsync(directory.path), ServiceException)).info.name);

    await context.database.connection.executeAsync(new SqlQuery("DELETE FROM __migrations WHERE id='9999-future'"));
    await context.database.connection.executeAsync(new SqlQuery(`UPDATE __migrations SET id='0000-other' WHERE id='${Resources.initialMigrationId}'`));
    Assert.areEqual(ErrorCode.VersionMismatch, (await Assert.throwsAsync(() => DatabaseContext.openAsync(directory.path), ServiceException)).info.name);
  }

  @TestMethod
  public async disposalClosesTheConnection(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const context = await DatabaseContext.openAsync(directory.path);
    await context[Symbol.asyncDispose]();

    Assert.isFalse(context.database.connection.isOpen);
  }
}
