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
import { DatabaseContext, DepartmentsMigration, MigrationCatalog } from "@noldova/teamrun.core";

import { LegacyDatabaseContext } from "../../fixtures/legacy-database-context.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class DepartmentsMigrationTests {
  @TestMethod
  public keysEachTeammateToOneDepartmentAndEachDepartmentToItsParent(): void {
    const migration = new DepartmentsMigration();
    const builder = new MigrationBuilder();
    migration.apply(builder);
    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));

    Assert.areEqual("20261120120000_Departments", migration.id);
    Assert.areEqual(4, statements.length);
    Assert.isTrue(statements[0]?.includes("\"parentId\" TEXT,") ?? false);
    Assert.isTrue(statements[0]?.includes("FOREIGN KEY (\"parentId\") REFERENCES \"departments\" (\"id\")") ?? false);
    Assert.isTrue(statements[2]?.includes("PRIMARY KEY (\"teammateId\")") ?? false);
    Assert.isTrue(statements[2]?.includes("FOREIGN KEY (\"teammateId\") REFERENCES \"teammates\" (\"id\")") ?? false);
    Assert.isTrue(statements[2]?.includes("FOREIGN KEY (\"departmentId\") REFERENCES \"departments\" (\"id\")") ?? false);
  }

  @TestMethod
  public async upgradesAnExistingDatabaseKeepingItsRowsAndRefusesADepartmentUnderAnUnknownOne(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const oldJson = '{"id":"p","name":"Legacy","rootPath":"fixture","createdAt":"t"}';
    {
      await using legacy = await LegacyDatabaseContext.openAsync(directory.path);
      await legacy.database.connection.executeAsync(new SqlQuery(
        "INSERT INTO projects (id, rootPath, json, createdAt, updatedAt) VALUES ('p', 'fixture', ?, 't', 't')", [oldJson]));
    }
    await using current = await DatabaseContext.openAsync(directory.path);
    const connection = current.database.connection;
    await connection.executeAsync(new SqlQuery("INSERT INTO teammates (id, name, json, createdAt, updatedAt) VALUES ('t1', 'ada', '{}', 't', 't')"));
    await connection.executeAsync(new SqlQuery("INSERT INTO departments (id, parentId, json, createdAt, updatedAt) VALUES ('d1', NULL, '{}', 't', 't')"));

    Assert.areEqual(MigrationCatalog.all.length, (await current.database.getAppliedMigrationsAsync()).length);
    Assert.areEqual(oldJson, (await connection.queryAsync(new SqlQuery("SELECT json FROM projects WHERE id = 'p'")))[0]?.readString("json"));
    await Assert.throwsAsync(() => connection.executeAsync(new SqlQuery(
      "INSERT INTO departments (id, parentId, json, createdAt, updatedAt) VALUES ('d2', 'gone', '{}', 't', 't')")), Error);
  }
}
