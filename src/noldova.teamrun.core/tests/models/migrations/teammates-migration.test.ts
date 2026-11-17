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
import { DatabaseContext, MigrationCatalog, TeammatesMigration } from "@noldova/teamrun.core";
import { LegacyDatabaseContext } from "../../fixtures/legacy-database-context.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class TeammatesMigrationTests {
  @TestMethod
  public async addsMembershipKeysWithoutChangingTheInitialMigration(): Promise<void> {
    const migration = new TeammatesMigration();
    Assert.areEqual("20260915120000_Teammates", migration.id);
    const builder = new MigrationBuilder();
    migration.apply(builder);
    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));
    Assert.areEqual(4, statements.length);
    Assert.isTrue(statements.includes("CREATE UNIQUE INDEX \"IX_teammates_name\" ON \"teammates\" (\"name\")"));
    Assert.isTrue(statements[2]?.includes("PRIMARY KEY (\"conversationId\", \"teammateId\")") ?? false);
    Assert.isTrue(statements[2]?.includes("FOREIGN KEY (\"teammateId\") REFERENCES \"teammates\" (\"id\")") ?? false);
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    Assert.areEqual(MigrationCatalog.all.length, (await context.database.getAppliedMigrationsAsync()).length);
    await Assert.throwsAsync(() => context.database.connection.executeAsync(new SqlQuery(
      "INSERT INTO chatTeammates (chatId, teammateId, json, joinedAt) VALUES ('missing', 'missing', '{}', 't')")), Error);
  }

  @TestMethod
  public async upgradesAnExistingDatabaseWithoutRewritingItsRows(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const oldJson = '{"id":"p","name":"Legacy","rootPath":"fixture","createdAt":"t"}';
    {
      await using legacy = await LegacyDatabaseContext.openAsync(directory.path);
      Assert.areEqual(1, (await legacy.database.getAppliedMigrationsAsync()).length);
      await legacy.database.connection.executeAsync(new SqlQuery(
        "INSERT INTO projects (id, rootPath, json, createdAt, updatedAt) VALUES ('p', 'fixture', ?, 't', 't')", [oldJson]));
    }
    {
      await using current = await DatabaseContext.openAsync(directory.path);
      Assert.areEqual(MigrationCatalog.all.length, (await current.database.getAppliedMigrationsAsync()).length);
      Assert.areEqual(oldJson, (await current.database.connection.queryAsync(new SqlQuery("SELECT json FROM projects WHERE id = 'p'")))[0]?.readString("json"));
      Assert.areEqual(0, (await current.database.connection.queryAsync(new SqlQuery("SELECT * FROM teammates"))).length);
    }
    await using reopened = await DatabaseContext.openAsync(directory.path);
    Assert.areEqual(MigrationCatalog.all.length, (await reopened.database.getAppliedMigrationsAsync()).length);
    Assert.areEqual(0, (await reopened.database.getPendingMigrationsAsync()).length);
  }
}
