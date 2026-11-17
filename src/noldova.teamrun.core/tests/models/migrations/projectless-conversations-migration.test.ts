/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MigrationBuilder, type SqlConnection, SqlQuery } from "@noldova/context.data.sql";
import { SQLiteDialect } from "@noldova/context.data.sql.sqlite";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DatabaseContext, MigrationCatalog, ProjectlessConversationsMigration, Resources } from "@noldova/teamrun.core";

import { LegacyDatabaseContext } from "../../fixtures/legacy-database-context.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class ProjectlessConversationsMigrationTests {
  private static readonly counted: readonly (readonly [string, string])[] = [["projects", "projects"], ["conversations", "chats"], ["messages", "messages"],
    ["teammates", "teammates"], ["conversationTeammates", "chatTeammates"], ["drafts", "drafts"], ["readingPositions", "readingPositions"]];

  @TestMethod
  public copiesTheChatsAsideAndRebuildsTheirTableWithANullableProjectStillKeyedToProjects(): void {
    const migration = new ProjectlessConversationsMigration();
    Assert.areEqual("20261024190000_ProjectlessConversations", migration.id);
    const builder = new MigrationBuilder();
    migration.apply(builder);

    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));

    Assert.areEqual([
      "PRAGMA defer_foreign_keys = ON",
      "CREATE TABLE conversationsCopy AS SELECT id, projectId, json, createdAt, updatedAt FROM conversations",
      "DROP TABLE conversations",
      "CREATE TABLE \"conversations\" (\"id\" TEXT NOT NULL, \"projectId\" TEXT, \"json\" TEXT NOT NULL, \"createdAt\" TEXT NOT NULL, \"updatedAt\" TEXT NOT NULL, PRIMARY KEY (\"id\"), "
        + "FOREIGN KEY (\"projectId\") REFERENCES \"projects\" (\"id\"))",
      "CREATE INDEX \"IX_conversations_projectId\" ON \"conversations\" (\"projectId\")",
      "INSERT INTO conversations (id, projectId, json, createdAt, updatedAt) SELECT id, projectId, json, createdAt, updatedAt FROM conversationsCopy",
      "DROP TABLE conversationsCopy"
    ].join("\n"), statements.join("\n"));
  }

  @TestMethod
  public async keepsEveryChatAndWhatPointsAtItWithForeignKeysOnAndThenTakesAChatWithoutAProject(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    let before = "";
    {
      const earlier = MigrationCatalog.all.slice(0, MigrationCatalog.all.findIndex(t => t instanceof ProjectlessConversationsMigration));
      await using legacy = await LegacyDatabaseContext.openAsync(directory.path, earlier);
      const connection = legacy.database.connection;
      const execute = async (statement: string): Promise<number> => connection.executeAsync(new SqlQuery(statement));
      await execute("INSERT INTO projects (id, rootPath, json, createdAt, updatedAt) VALUES ('pr1', '/work', '{\"id\":\"pr1\"}', 't', 't')");
      await execute("INSERT INTO teammates (id, name, json, createdAt, updatedAt) VALUES ('t1', 'alice', '{}', 't', 't')");
      for (const id of ["c1", "c2"]) {
        await execute(`INSERT INTO conversations (id, projectId, json, createdAt, updatedAt) VALUES ('${id}', 'pr1', '{"id":"${id}"}', 'created', 'updated')`);
        await execute(`INSERT INTO messages (id, conversationId, sequence, status, json, createdAt, updatedAt) VALUES ('${id}m1', '${id}', 1, 'Completed', '{}', 't', 't')`);
        await execute(`INSERT INTO messages (id, conversationId, sequence, status, json, createdAt, updatedAt) VALUES ('${id}m2', '${id}', 2, 'Completed', '{}', 't', 't')`);
        await execute(`INSERT INTO conversationTeammates (conversationId, teammateId, json, joinedAt) VALUES ('${id}', 't1', '{}', 't')`);
        await execute(`INSERT INTO readingPositions (conversationId, json, updatedAt) VALUES ('${id}', '{}', 't')`);
      }
      await execute("INSERT INTO drafts (conversationId, json, revision, updatedAt) VALUES ('c1', '{}', 3, 't')");
      before = await ProjectlessConversationsMigrationTests.countsAsync(connection, true);
    }

    await using current = await DatabaseContext.openAsync(directory.path);
    const connection = current.database.connection;
    const names = async (statement: string): Promise<string> => (await connection.queryAsync(new SqlQuery(statement))).map(t => t.readString("name")).join(",");

    Assert.areEqual(1, (await connection.queryAsync(new SqlQuery("PRAGMA foreign_keys")))[0]?.readInteger("foreign_keys"));
    Assert.areEqual(MigrationCatalog.all.length, (await current.database.getAppliedMigrationsAsync()).length);
    Assert.areEqual("projects 1, chats 2, messages 4, teammates 1, chatTeammates 2, drafts 1, readingPositions 2", before);
    Assert.areEqual(before, await ProjectlessConversationsMigrationTests.countsAsync(connection, false));
    Assert.areEqual(0, (await connection.queryAsync(new SqlQuery("PRAGMA foreign_key_check"))).length);
    Assert.areEqual("c1 pr1 {\"id\":\"c1\"} created updated,c2 pr1 {\"id\":\"c2\"} created updated", (await connection.queryAsync(
      new SqlQuery("SELECT id, projectId, json, createdAt, updatedAt FROM chats ORDER BY id")))
      .map(t => [t.readString("id"), t.readString("projectId"), t.readString("json"), t.readString("createdAt"), t.readString("updatedAt")].join(" ")).join(","));
    Assert.areEqual("IX_chats_projectId", await names("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'chats' AND name LIKE 'IX_%'"));
    Assert.areEqual("", await names("SELECT name FROM sqlite_master WHERE name = 'conversationsCopy'"));
    await connection.executeAsync(new SqlQuery("INSERT INTO chats (id, projectId, json, createdAt, updatedAt) VALUES ('c3', NULL, '{}', 't', 't')"));
    Assert.isNull((await connection.queryAsync(new SqlQuery("SELECT projectId FROM chats WHERE id = 'c3'")))[0]?.readNullableString("projectId"));
    await Assert.throwsAsync(() => connection.executeAsync(new SqlQuery("INSERT INTO chats (id, projectId, json, createdAt, updatedAt) VALUES ('c4', 'missing', '{}', 't', 't')")),
      Error);
    await Assert.throwsAsync(() => connection.executeAsync(new SqlQuery("DELETE FROM chats WHERE id = 'c1'")), Error);
    Assert.isTrue(Resources.projectlessConversationsMigrationId > Resources.replyCheckpointsMigrationId);
  }

  private static async countsAsync(connection: SqlConnection, legacy: boolean): Promise<string> {
    return (await Promise.all(ProjectlessConversationsMigrationTests.counted
      .map(async ([earlier, name]) => `${name} ${(await connection.queryAsync(new SqlQuery(`SELECT COUNT(*) AS count FROM ${legacy ? earlier : name}`)))[0]?.readInteger("count")}`)))
      .join(", ");
  }
}
