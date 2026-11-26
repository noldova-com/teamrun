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
import { ForgottenSessionsMigration, MigrationCatalog, Resources } from "@noldova/teamrun.core";
import { LegacyDatabaseContext } from "../../fixtures/legacy-database-context.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";
import { TestDatabase } from "../../fixtures/test-database.fixture.js";

@TestClass
export class ForgottenSessionsMigrationTests {
  @TestMethod
  public runsOneStatementUnderItsOwnId(): void {
    const migration = new ForgottenSessionsMigration();
    Assert.areEqual("20261018180000_ForgottenSessions", migration.id);
    const builder = new MigrationBuilder();
    migration.apply(builder);

    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));

    Assert.areEqual(Resources.addForgottenSessions, statements.join(";"));
  }

  @TestMethod
  public async keepsAStoredProviderWithNoForgottenSessions(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    {
      await using legacy = await LegacyDatabaseContext.openAsync(directory.path);
      await legacy.database.connection.executeAsync(new SqlQuery("INSERT INTO providerAccounts (id, provider, json, createdAt, updatedAt) VALUES ('a1', 'fake', '{}', 't', 't')"));
    }
    await using current = await TestDatabase.openAsync(directory.path);

    const [record] = await current.database.connection.queryAsync(new SqlQuery("SELECT json, forgottenSessions FROM providers WHERE id = 'a1'"));

    Assert.areEqual(MigrationCatalog.all.length, (await current.database.getAppliedMigrationsAsync()).length);
    Assert.areEqual("{}", record?.readString("json"));
    Assert.isNull(record?.readNullableString("forgottenSessions") ?? null);
  }
}
