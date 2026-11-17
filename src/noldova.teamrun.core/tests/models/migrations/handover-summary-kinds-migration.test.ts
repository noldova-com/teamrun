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
import { HandoverSummaryKindsMigration, Resources } from "@noldova/teamrun.core";
import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class HandoverSummaryKindsMigrationTests {
  @TestMethod
  public async keepsTheKindThatWroteEachSummaryAndLeavesAnEarlierSummarysKindEmpty(): Promise<void> {
    const migration = new HandoverSummaryKindsMigration();
    const builder = new MigrationBuilder();
    migration.apply(builder);
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const connection = host.context.database.connection;

    await connection.executeAsync(new SqlQuery("INSERT INTO handoverSummaries (chatId, teammateId, through, text) VALUES (?, 'ann', 2, 'Earlier')", [chat.id]));
    await connection.executeAsync(new SqlQuery(Resources.upsertHandoverSummary, [chat.id, "bob", 4, "Older", "claude"]));
    await connection.executeAsync(new SqlQuery(Resources.upsertHandoverSummary, [chat.id, "bob", 9, "Newer", "codex"]));
    const rows = (await connection.queryAsync(new SqlQuery("SELECT teammateId, kind FROM handoverSummaries ORDER BY teammateId", [])))
      .map(t => `${t.readString("teammateId")}:${t.readNullableString("kind") ?? "none"}`);

    Assert.areEqual("20261112040000_HandoverSummaryKinds", migration.id);
    Assert.areEqual(Resources.addHandoverSummaryKind, builder.toOperations().map(t => t.render(new SQLiteDialect())).join(";"));
    Assert.areEqual("ann:none,bob:codex", rows.join(","));
    Assert.areEqual([chat.id, "codex", "Newer"].join("|"),
      (await connection.queryAsync(new SqlQuery(Resources.selectHandoverSummary, [chat.id, "bob", 9]))).map(t => [chat.id, t.readString("kind"), t.readString("text")].join("|")).join());
  }
}
