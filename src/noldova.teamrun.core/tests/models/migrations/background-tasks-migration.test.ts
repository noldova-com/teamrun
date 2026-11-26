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
import { BackgroundTasksMigration } from "@noldova/teamrun.core";

import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";
import { TestDatabase } from "../../fixtures/test-database.fixture.js";

@TestClass
export class BackgroundTasksMigrationTests {
  @TestMethod
  public async keysEachTaskByIdToAnExistingChatAndIndexesItsChat(): Promise<void> {
    const migration = new BackgroundTasksMigration();
    Assert.areEqual("20261102000000_BackgroundTasks", migration.id);
    const builder = new MigrationBuilder();
    migration.apply(builder);
    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));
    Assert.areEqual(2, statements.length);
    Assert.isTrue(statements[0]?.includes("PRIMARY KEY (\"id\")") ?? false);
    Assert.isTrue(statements[0]?.includes("FOREIGN KEY (\"chatId\") REFERENCES \"chats\" (\"id\")") ?? false);
    Assert.isTrue(statements[1]?.includes("\"IX_backgroundTasks_chatId\" ON \"backgroundTasks\" (\"chatId\")") ?? false);
    using directory = new TemporaryDataDirectory();
    await using context = await TestDatabase.openAsync(directory.path);
    await Assert.throwsAsync(() => context.database.connection.executeAsync(
      new SqlQuery("INSERT INTO backgroundTasks (id, chatId, json, output) VALUES ('t', 'none', '{}', '')")), Error);
  }
}
