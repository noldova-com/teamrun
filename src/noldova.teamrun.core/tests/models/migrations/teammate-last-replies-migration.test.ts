/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MigrationBuilder, type SqlConnection, SqlQuery } from "@noldova/context.data.sql";
import { SQLiteDialect } from "@noldova/context.data.sql.sqlite";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { MigrationCatalog, Resources, TeammateLastRepliesMigration } from "@noldova/teamrun.core";

import { LegacyDatabaseContext } from "../../fixtures/legacy-database-context.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";
import { TestDatabase } from "../../fixtures/test-database.fixture.js";

@TestClass
export class TeammateLastRepliesMigrationTests {
  private static readonly index: string = "IX_messages_teammateId_endedAt";
  private static readonly selectIndexes: string = "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'messages' ORDER BY name";

  @TestMethod
  public indexesTheCompletedProviderRepliesByTeammateAndEndTime(): void {
    const migration = new TeammateLastRepliesMigration();
    const builder = new MigrationBuilder();
    migration.apply(builder);

    Assert.areEqual("20261122090000_TeammateLastReplies", migration.id);
    Assert.areEqual([Resources.createTeammateLastReplyIndex].join(), builder.toOperations().map(t => t.render(new SQLiteDialect())).join());
  }

  @TestMethod
  public async upgradesADatabaseFromTheMigrationBeforeWithTheIndex(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const indexes = async (connection: SqlConnection): Promise<string> =>
      (await connection.queryAsync(new SqlQuery(TeammateLastRepliesMigrationTests.selectIndexes))).map(t => t.readString("name")).join(",");
    {
      await using legacy = await LegacyTestDatabase.openAsync(directory.path, MigrationCatalog.all.slice(0, MigrationCatalog.all.findIndex(t => t instanceof TeammateLastRepliesMigration)));
      Assert.isFalse((await indexes(legacy.database.connection)).includes(TeammateLastRepliesMigrationTests.index));
    }
    await using current = await TestDatabase.openAsync(directory.path);

    Assert.isTrue((await indexes(current.database.connection)).includes(TeammateLastRepliesMigrationTests.index));
  }
}
