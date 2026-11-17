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
import { InitialMigration, Resources, DatabaseContext } from "@noldova/teamrun.core";

import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class InitialMigrationTests {
  private static readonly SELECT_NAMES: string = "SELECT name FROM sqlite_master WHERE type = ? ORDER BY name";

  @TestMethod
  public carriesTheInitialId(): void {
    Assert.areEqual(Resources.initialMigrationId, new InitialMigration().id);
  }

  @TestMethod
  public declaresEveryRecordTableWithItsIndexes(): void {
    const builder = new MigrationBuilder();
    new InitialMigration().apply(builder);
    const dialect = new SQLiteDialect();
    const statements = builder.toOperations().map(t => t.render(dialect));

    Assert.areEqual(11, statements.length);
    Assert.areEqual(
      "CREATE TABLE \"projects\" (\"id\" TEXT NOT NULL, \"rootPath\" TEXT NOT NULL, \"json\" TEXT NOT NULL, \"createdAt\" TEXT NOT NULL, \"updatedAt\" TEXT NOT NULL, PRIMARY KEY (\"id\"))",
      statements[0]);
    Assert.areEqual("CREATE UNIQUE INDEX \"IX_projects_rootPath\" ON \"projects\" (\"rootPath\")", statements[1]);
    Assert.isTrue(statements.some(t => t.endsWith("PRIMARY KEY (\"id\"), FOREIGN KEY (\"conversationId\") REFERENCES \"conversations\" (\"id\"))")));
    Assert.isTrue(statements.some(t => t === "CREATE UNIQUE INDEX \"IX_messages_conversationId_sequence\" ON \"messages\" (\"conversationId\", \"sequence\")"));
  }

  @TestMethod
  public async createsTheSchemaInTheContext(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);

    const names = async (type: string): Promise<readonly string[]> =>
      (await context.database.connection.queryAsync(new SqlQuery(InitialMigrationTests.SELECT_NAMES, [type]))).map(t => t.readString("name"));
    const tables = await names("table");
    const indexes = (await names("index")).filter(t => t.startsWith("IX_"));

    Assert.areEqual("__changes,__migrations,accountLimits,acpAgents,approvals,backgroundTasks,chatTeammates,chatWakes,chats,drafts,handoverSummaries,messageText,messageText_config,messageText_content,messageText_data,messageText_docsize,messageText_idx,messages,preferences,projects,providers,readingPositions,runOutputs,sharedMcpServers,sqlite_sequence,sustainAttempts,teammates,waitingMessages", tables.join(","));
    Assert.areEqual(14, indexes.length);
    const orphan = "INSERT INTO chats (id, projectId, json, createdAt, updatedAt) VALUES ('c', 'missing', '{}', 't', 't')";
    await Assert.throwsAsync(() => context.database.connection.executeAsync(new SqlQuery(orphan)), Error);
  }
}
