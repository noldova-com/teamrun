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
import { HandoverSummariesMigration, Resources } from "@noldova/teamrun.core";
import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class HandoverSummariesMigrationTests {
  @TestMethod
  public async keysEachSummaryByItsChatAndTeammateAndKeepsOnlyTheLatestOfEach(): Promise<void> {
    const migration = new HandoverSummariesMigration();
    const builder = new MigrationBuilder();
    migration.apply(builder);
    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const connection = host.context.database.connection;

    await connection.executeAsync(new SqlQuery(Resources.upsertHandoverSummary, [chat.id, "bob", 4, "Older", "fake"]));
    await connection.executeAsync(new SqlQuery(Resources.upsertHandoverSummary, [chat.id, "bob", 9, "Newer", "fake"]));
    const rows = (await connection.queryAsync(new SqlQuery("SELECT through, text FROM handoverSummaries", []))).map(t => `${t.readInteger("through")}:${t.readString("text")}`);

    Assert.areEqual("20261112030000_HandoverSummaries", migration.id);
    Assert.areEqual(1, statements.length);
    Assert.isTrue(statements[0]?.includes("PRIMARY KEY (\"chatId\", \"teammateId\")") ?? false);
    Assert.isTrue(statements[0]?.includes("FOREIGN KEY (\"chatId\") REFERENCES \"chats\" (\"id\")") ?? false);
    Assert.areEqual("9:Newer", rows.join(","));
    await Assert.throwsAsync(() => connection.executeAsync(new SqlQuery(Resources.upsertHandoverSummary, ["none", "bob", 1, "Text", "fake"])), Error);
  }
}
