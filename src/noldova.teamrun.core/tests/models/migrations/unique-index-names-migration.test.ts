/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { MigrationBuilder, SqlQuery } from "@noldova/context.data.sql";
import { SQLiteDialect } from "@noldova/context.data.sql.sqlite";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { MigrationCatalog, UniqueIndexNamesMigration } from "@noldova/teamrun.core";

import { LegacyDatabaseContext } from "../../fixtures/legacy-database-context.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";
import { TestDatabase } from "../../fixtures/test-database.fixture.js";

@TestClass
export class UniqueIndexNamesMigrationTests {
  private static readonly SELECT_UNIQUE: string =
    "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND sql LIKE 'CREATE UNIQUE INDEX%' ORDER BY name";
  private static readonly UX_SQL: string = [
    "UX_messages_chatId_sequence:CREATE UNIQUE INDEX \"UX_messages_chatId_sequence\" ON \"messages\" (\"chatId\", \"sequence\")",
    "UX_projects_rootPath:CREATE UNIQUE INDEX \"UX_projects_rootPath\" ON \"projects\" (\"rootPath\")",
    "UX_sharedMcpServers_name:CREATE UNIQUE INDEX \"UX_sharedMcpServers_name\" ON \"sharedMcpServers\" (\"name\")",
    "UX_teammates_name:CREATE UNIQUE INDEX \"UX_teammates_name\" ON \"teammates\" (\"name\")"].join("\n");
  private static readonly MADE_AS_IX: readonly string[] = [
    "DROP INDEX UX_projects_rootPath", "CREATE UNIQUE INDEX IX_projects_rootPath ON projects (rootPath)",
    "DROP INDEX UX_messages_chatId_sequence", "CREATE UNIQUE INDEX IX_messages_chatId_sequence ON messages (chatId, sequence)",
    "DROP INDEX UX_teammates_name", "CREATE UNIQUE INDEX IX_teammates_name ON teammates (name)",
    "DROP INDEX UX_sharedMcpServers_name", "CREATE UNIQUE INDEX IX_sharedMcpServers_name ON sharedMcpServers (name)"];

  @TestMethod
  public createsEachUniqueIndexUnderItsUxNameBeforeDroppingItsIxOne(): void {
    const migration = new UniqueIndexNamesMigration();
    const builder = new MigrationBuilder();
    migration.apply(builder);

    Assert.areEqual("20261125090000_UniqueIndexNames", migration.id);
    Assert.areEqual([
      "CREATE UNIQUE INDEX IF NOT EXISTS \"UX_projects_rootPath\" ON \"projects\" (\"rootPath\")",
      "DROP INDEX IF EXISTS IX_projects_rootPath",
      "CREATE UNIQUE INDEX IF NOT EXISTS \"UX_messages_chatId_sequence\" ON \"messages\" (\"chatId\", \"sequence\")",
      "DROP INDEX IF EXISTS IX_messages_chatId_sequence",
      "CREATE UNIQUE INDEX IF NOT EXISTS \"UX_teammates_name\" ON \"teammates\" (\"name\")",
      "DROP INDEX IF EXISTS IX_teammates_name",
      "CREATE UNIQUE INDEX IF NOT EXISTS \"UX_sharedMcpServers_name\" ON \"sharedMcpServers\" (\"name\")",
      "DROP INDEX IF EXISTS IX_sharedMcpServers_name"
    ].join("\n"), builder.toOperations().map(t => t.render(new SQLiteDialect())).join("\n"));
  }

  @TestMethod
  public async renamesTheIxUniqueIndexesOfADatabaseMadeBeforeThemAndKeepsItsRowsAndTheirUniqueness(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const before = MigrationCatalog.all.slice(0, MigrationCatalog.all.findIndex(t => t instanceof UniqueIndexNamesMigration));
    const json = '{"id":"p","name":"Legacy","rootPath":"fixture","createdAt":"t"}';
    {
      await using legacy = await LegacyTestDatabase.openAsync(directory.path, before);
      const execute = async (statement: string, parameters: readonly string[] = []): Promise<number> =>
        legacy.database.connection.executeAsync(new SqlQuery(statement, parameters));
      for (const statement of UniqueIndexNamesMigrationTests.MADE_AS_IX)
        await execute(statement);
      await execute("INSERT INTO projects (id, rootPath, json, createdAt, updatedAt) VALUES ('p', 'fixture', ?, 't', 't')", [json]);
    }
    await using current = await TestDatabase.openAsync(directory.path);
    const connection = current.database.connection;
    const unique = (await connection.queryAsync(new SqlQuery(UniqueIndexNamesMigrationTests.SELECT_UNIQUE))).map(t => `${t.readString("name")}:${t.readString("sql")}`);

    Assert.areEqual(MigrationCatalog.all.map(t => t.id).join(), (await current.database.getAppliedMigrationsAsync()).join());
    Assert.areEqual(UniqueIndexNamesMigrationTests.UX_SQL, unique.join("\n"));
    Assert.areEqual(json, (await connection.queryAsync(new SqlQuery("SELECT json FROM projects WHERE id = 'p'")))[0]?.readString("json"));
    await Assert.throwsAsync(() => connection.executeAsync(new SqlQuery("INSERT INTO projects (id, rootPath, json, createdAt, updatedAt) VALUES ('q', 'fixture', '{}', 't', 't')")), Error);
  }

  @TestMethod
  public async leavesTheUxUniqueIndexesOfANewDatabaseAsTheyAre(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using current = await TestDatabase.openAsync(directory.path);
    const unique = (await current.database.connection.queryAsync(new SqlQuery(UniqueIndexNamesMigrationTests.SELECT_UNIQUE)))
      .map(t => `${t.readString("name")}:${t.readString("sql")}`);

    Assert.areEqual(MigrationCatalog.all.length, (await current.database.getAppliedMigrationsAsync()).length);
    Assert.areEqual(UniqueIndexNamesMigrationTests.UX_SQL, unique.join("\n"));
  }
}
