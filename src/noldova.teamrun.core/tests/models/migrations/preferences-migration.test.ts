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
import { PreferencesMigration } from "@noldova/teamrun.core";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";
import { TestDatabase } from "../../fixtures/test-database.fixture.js";

@TestClass
export class PreferencesMigrationTests {
  @TestMethod
  public async keysOneJsonValueToEachPreferenceName(): Promise<void> {
    const migration = new PreferencesMigration();
    Assert.areEqual("20261023180000_Preferences", migration.id);
    const builder = new MigrationBuilder();
    migration.apply(builder);
    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));
    Assert.areEqual(1, statements.length);
    Assert.isTrue(statements[0]?.includes("PRIMARY KEY (\"name\")") ?? false);
    Assert.isTrue(statements[0]?.includes("\"json\" TEXT NOT NULL") ?? false);
    using directory = new TemporaryDataDirectory();
    await using context = await TestDatabase.openAsync(directory.path);
    await context.database.connection.executeAsync(new SqlQuery("INSERT INTO preferences (name, json, updatedAt) VALUES ('a', '{}', 't')"));
    await Assert.throwsAsync(() => context.database.connection.executeAsync(new SqlQuery("INSERT INTO preferences (name, json, updatedAt) VALUES ('a', '{}', 't')")), Error);
  }
}
