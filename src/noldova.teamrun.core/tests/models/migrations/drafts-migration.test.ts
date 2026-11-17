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
import { DatabaseContext, DraftsMigration } from "@noldova/teamrun.core";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class DraftsMigrationTests {
  @TestMethod
  public async keysOneDraftToAnExistingConversation(): Promise<void> {
    const migration = new DraftsMigration();
    Assert.areEqual("20261017120000_Drafts", migration.id);
    const builder = new MigrationBuilder();
    migration.apply(builder);
    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));
    Assert.areEqual(1, statements.length);
    Assert.isTrue(statements[0]?.includes("PRIMARY KEY (\"conversationId\")") ?? false);
    Assert.isTrue(statements[0]?.includes("FOREIGN KEY (\"conversationId\") REFERENCES \"conversations\" (\"id\")") ?? false);
    Assert.isFalse(statements[0]?.includes("\"json\" TEXT NOT NULL") ?? true);
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    await Assert.throwsAsync(() => context.database.connection.executeAsync(new SqlQuery(
      "INSERT INTO drafts (chatId, json, revision, updatedAt) VALUES ('missing', '{}', 1, 't')")), Error);
  }
}
