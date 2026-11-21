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
import { DatabaseContext, MigrationCatalog, OrganizationMessagesMigration } from "@noldova/teamrun.core";

import { LegacyDatabaseContext } from "../../fixtures/legacy-database-context.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class OrganizationMessagesMigrationTests {
  @TestMethod
  public keysEachMessageByItsId(): void {
    const migration = new OrganizationMessagesMigration();
    const builder = new MigrationBuilder();
    migration.apply(builder);
    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));

    Assert.areEqual("20261121090000_OrganizationMessages", migration.id);
    Assert.areEqual(1, statements.length);
    Assert.isTrue(statements[0]?.includes("CREATE TABLE \"organizationMessages\"") ?? false);
    Assert.isTrue(statements[0]?.includes("PRIMARY KEY (\"id\")") ?? false);
  }

  @TestMethod
  public async upgradesAnExistingDatabaseKeepingItsRowsAndRefusesASecondMessageWithTheSameId(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const oldJson = '{"id":"p","name":"Legacy","rootPath":"fixture","createdAt":"t"}';
    {
      await using legacy = await LegacyDatabaseContext.openAsync(directory.path);
      await legacy.database.connection.executeAsync(new SqlQuery(
        "INSERT INTO projects (id, rootPath, json, createdAt, updatedAt) VALUES ('p', 'fixture', ?, 't', 't')", [oldJson]));
    }
    await using current = await DatabaseContext.openAsync(directory.path);
    const connection = current.database.connection;
    await connection.executeAsync(new SqlQuery("INSERT INTO organizationMessages (id, json, createdAt) VALUES ('o1', '{}', 't')"));

    Assert.areEqual(MigrationCatalog.all.length, (await current.database.getAppliedMigrationsAsync()).length);
    Assert.areEqual(oldJson, (await connection.queryAsync(new SqlQuery("SELECT json FROM projects WHERE id = 'p'")))[0]?.readString("json"));
    await Assert.throwsAsync(() => connection.executeAsync(new SqlQuery("INSERT INTO organizationMessages (id, json, createdAt) VALUES ('o1', '{}', 't')")), Error);
  }
}
