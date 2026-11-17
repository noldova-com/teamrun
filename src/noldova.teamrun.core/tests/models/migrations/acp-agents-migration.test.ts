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
import { AcpAgentsMigration, DatabaseContext } from "@noldova/teamrun.core";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class AcpAgentsMigrationTests {
  @TestMethod
  public async keepsEachAddedAgentOncePerKind(): Promise<void> {
    const migration = new AcpAgentsMigration();
    Assert.areEqual("20261102180000_AcpAgents", migration.id);
    const builder = new MigrationBuilder();
    migration.apply(builder);
    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));
    Assert.areEqual(1, statements.length);
    Assert.isTrue(statements[0]?.includes("PRIMARY KEY (\"kind\")") ?? false);
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    const insert = new SqlQuery("INSERT INTO acpAgents (kind, name, json, createdAt, updatedAt) VALUES ('droid', 'Droid', '{}', 't', 't')");
    await context.database.connection.executeAsync(insert);
    await Assert.throwsAsync(() => context.database.connection.executeAsync(insert), Error);
  }
}
