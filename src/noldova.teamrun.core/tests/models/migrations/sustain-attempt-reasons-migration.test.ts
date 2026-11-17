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
import { Resources, SustainAttemptReasonsMigration } from "@noldova/teamrun.core";
import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class SustainAttemptReasonsMigrationTests {
  @TestMethod
  public async addsEachAttemptsReasonGivesARowWithoutOneALimitAndLetsALimitReplaceNoRoomButNotTheOtherWay(): Promise<void> {
    const migration = new SustainAttemptReasonsMigration();
    const builder = new MigrationBuilder();
    migration.apply(builder);
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const connection = host.context.database.connection;
    await connection.executeAsync(new SqlQuery("INSERT INTO sustainAttempts (chainId, teammateId, providerId, chatId) VALUES ('r', 't', 'p', ?)", [chat.id]));
    await connection.executeAsync(new SqlQuery("INSERT INTO sustainAttempts (chainId, teammateId, providerId, chatId, reason) VALUES ('r', 't', 'q', ?, ?)",
      [chat.id, Resources.sustainAttemptNoRoom]));
    const later: readonly (readonly [string, string])[] = [["p", Resources.sustainAttemptNoRoom], ["q", Resources.sustainAttemptLimit],
      ["r", Resources.sustainAttemptNoRoom], ["r", Resources.sustainAttemptLimit], ["r", Resources.sustainAttemptNoRoom]];

    for (const [provider, reason] of later)
      await connection.executeAsync(new SqlQuery(Resources.insertSustainAttempt, ["r", "t", provider, chat.id, reason]));
    const rows = (await connection.queryAsync(new SqlQuery("SELECT providerId, reason FROM sustainAttempts ORDER BY providerId", [])))
      .map(t => `${t.readString("providerId")}:${t.readString("reason")}`);

    Assert.areEqual("20261112020000_SustainAttemptReasons", migration.id);
    Assert.areEqual(Resources.addSustainAttemptReason, builder.toOperations().map(t => t.render(new SQLiteDialect())).join(";"));
    Assert.areEqual("p:limit,q:limit,r:limit", rows.join(","));
  }
}
