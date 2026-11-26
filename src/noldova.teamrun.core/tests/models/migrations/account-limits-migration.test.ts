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
import { AccountLimitsMigration } from "@noldova/teamrun.core";

import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";
import { TestDatabase } from "../../fixtures/test-database.fixture.js";

@TestClass
export class AccountLimitsMigrationTests {
  @TestMethod
  public async keysEachAccountLimitByItsProviderWithAnOptionalReset(): Promise<void> {
    const migration = new AccountLimitsMigration();
    Assert.areEqual("20261112000000_AccountLimits", migration.id);
    const builder = new MigrationBuilder();
    migration.apply(builder);
    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));
    Assert.areEqual(1, statements.length);
    Assert.isTrue(statements[0]?.includes("PRIMARY KEY (\"providerId\")") ?? false);
    using directory = new TemporaryDataDirectory();
    await using context = await TestDatabase.openAsync(directory.path);
    await context.database.connection.executeAsync(new SqlQuery("INSERT INTO accountLimits (providerId, seenAt, resetsAt) VALUES ('p', 't', NULL)"));
    await Assert.throwsAsync(() => context.database.connection.executeAsync(new SqlQuery("INSERT INTO accountLimits (providerId, seenAt, resetsAt) VALUES ('p', 'u', NULL)")), Error);
    await Assert.throwsAsync(() => context.database.connection.executeAsync(new SqlQuery("INSERT INTO accountLimits (providerId, seenAt, resetsAt) VALUES ('q', NULL, NULL)")), Error);
  }
}
