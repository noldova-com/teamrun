/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MigrationBuilder, SqlQuery } from "@noldova/teamrun-foundation-data-sql";
import { SQLiteDialect } from "@noldova/teamrun-foundation-data-sql-sqlite";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { InitialMigration, Resources, DatabaseContext } from "@noldova/teamrun-core";

import { TemporaryDataDirectory } from "../fixtures/temporary-data-directory.fixture.js";

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
    new InitialMigration().up(builder);
    const dialect = new SQLiteDialect();
    const statements = builder.toOperations().map(t => t.render(dialect));

    Assert.areEqual(11, statements.length);
    Assert.areEqual(
      "CREATE TABLE projects (id TEXT NOT NULL, rootPath TEXT NOT NULL, json TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, PRIMARY KEY (id))",
      statements[0]);
    Assert.areEqual("CREATE UNIQUE INDEX IX_projects_rootPath ON projects (rootPath)", statements[1]);
    Assert.isTrue(statements.some(t => t.endsWith("PRIMARY KEY (id), FOREIGN KEY (conversationId) REFERENCES conversations (id))")));
    Assert.isTrue(statements.some(t => t === "CREATE UNIQUE INDEX IX_messages_conversationId_sequence ON messages (conversationId, sequence)"));
  }

  @TestMethod
  public createsTheSchemaInTheContext(): void {
    using directory = new TemporaryDataDirectory();
    using context = DatabaseContext.open(directory.path);

    const names = (type: string): readonly string[] =>
      context.database.connection.query(new SqlQuery(InitialMigrationTests.SELECT_NAMES, [type])).map(t => t.readString("name"));
    const tables = names("table");
    const indexes = names("index").filter(t => t.startsWith("IX_"));

    Assert.areEqual("__migrations,approvals,conversationTeammates,conversations,messages,projects,providerAccounts,teammates", tables.join(","));
    Assert.areEqual(8, indexes.length);
    const orphan = "INSERT INTO conversations (id, projectId, json, createdAt, updatedAt) VALUES ('c', 'missing', '{}', 't', 't')";
    Assert.throws(() => context.database.connection.execute(new SqlQuery(orphan)), Error);
  }
}
