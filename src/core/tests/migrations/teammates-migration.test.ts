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
import { DatabaseContext, TeammatesMigration } from "@noldova/teamrun-core";
import { LegacyDatabaseContext } from "../fixtures/legacy-database-context.fixture.js";
import { TemporaryDataDirectory } from "../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class TeammatesMigrationTests {
  @TestMethod
  public addsMembershipKeysWithoutChangingTheInitialMigration(): void {
    const migration = new TeammatesMigration();
    Assert.areEqual("20260915120000_Teammates", migration.id);
    const builder = new MigrationBuilder();
    migration.up(builder);
    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));
    Assert.areEqual(4, statements.length);
    Assert.isTrue(statements.includes("CREATE UNIQUE INDEX IX_teammates_name ON teammates (name)"));
    Assert.isTrue(statements[2]?.includes("PRIMARY KEY (conversationId, teammateId)") ?? false);
    Assert.isTrue(statements[2]?.includes("FOREIGN KEY (teammateId) REFERENCES teammates (id)") ?? false);
    using directory = new TemporaryDataDirectory();
    using context = DatabaseContext.open(directory.path);
    Assert.areEqual(2, context.database.getAppliedMigrations().length);
    Assert.throws(() => context.database.connection.execute(new SqlQuery(
      "INSERT INTO conversationTeammates (conversationId, teammateId, json, joinedAt) VALUES ('missing', 'missing', '{}', 't')")), Error);
  }

  @TestMethod
  public upgradesAnExistingDatabaseWithoutRewritingItsRows(): void {
    using directory = new TemporaryDataDirectory();
    const oldJson = '{"id":"p","name":"Legacy","rootPath":"fixture","createdAt":"t"}';
    {
      using legacy = new LegacyDatabaseContext(directory.path);
      Assert.areEqual(1, legacy.database.getAppliedMigrations().length);
      legacy.database.connection.execute(new SqlQuery(
        "INSERT INTO projects (id, rootPath, json, createdAt, updatedAt) VALUES ('p', 'fixture', ?, 't', 't')", [oldJson]));
    }
    {
      using current = DatabaseContext.open(directory.path);
      Assert.areEqual(2, current.database.getAppliedMigrations().length);
      Assert.areEqual(oldJson, current.database.connection.query(new SqlQuery("SELECT json FROM projects WHERE id = 'p'"))[0]?.readString("json"));
      Assert.areEqual(0, current.database.connection.query(new SqlQuery("SELECT * FROM teammates")).length);
    }
    using reopened = DatabaseContext.open(directory.path);
    Assert.areEqual(2, reopened.database.getAppliedMigrations().length);
    Assert.areEqual(0, reopened.database.getPendingMigrations().length);
  }
}
