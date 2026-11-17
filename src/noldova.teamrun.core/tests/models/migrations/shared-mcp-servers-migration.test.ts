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
import { DatabaseContext, SharedMcpServersMigration } from "@noldova/teamrun.core";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class SharedMcpServersMigrationTests {
  @TestMethod
  public async keysEachServerByIdWithAUniqueName(): Promise<void> {
    const migration = new SharedMcpServersMigration();
    Assert.areEqual("20261025120000_SharedMcpServers", migration.id);
    const builder = new MigrationBuilder();
    migration.apply(builder);
    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));
    Assert.areEqual(2, statements.length);
    Assert.isTrue(statements[0]?.includes("PRIMARY KEY (\"id\")") ?? false);
    Assert.isTrue(statements[1]?.includes("UNIQUE") ?? false);
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    const insert = async (id: string): Promise<void> => {
      await context.database.connection.executeAsync(
        new SqlQuery("INSERT INTO sharedMcpServers (id, name, json, createdAt, updatedAt) VALUES (?, 'search', '{}', 't', 't')", [id]));
    };
    await insert("s1");
    await Assert.throwsAsync(() => insert("s2"), Error);
  }
}
