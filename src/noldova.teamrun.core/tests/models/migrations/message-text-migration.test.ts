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
import { MessageTextMigration } from "@noldova/teamrun.core";
import { DetailKind, Message, MessageAuthor, MessageDetail, MessageStatus } from "@noldova/teamrun.protocol";
import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class MessageTextMigrationTests {
  @TestMethod
  public async indexesTheTextDetailsOfTheSettledMessagesSavedBeforeAndAfterItSkippingJsonItCantRead(): Promise<void> {
    const migration = new MessageTextMigration();
    Assert.areEqual("20261108000000_MessageText", migration.id);
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const connection = host.context.database.connection;
    const message = (id: string, sequence: number, text: string): Message => new Message(id, chat.id, sequence, MessageAuthor.User, null, MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.Text, text, null, "t"), new MessageDetail(1, DetailKind.Reasoning, "a hidden saved thought", null, "t")], null, "t", null, "t");
    for (const statement of ["DROP TRIGGER messageTextInsert", "DROP TRIGGER messageTextUpdate", "DROP TRIGGER messageTextReopen", "DROP TRIGGER messageTextDelete", "DROP TABLE messageText"])
      await connection.executeAsync(new SqlQuery(statement));
    await host.messages.insertAsync(message("m1", 0, "Saved before the index"));
    await host.messages.insertAsync(message("m3", 2, "Saved while still running").withStatus(MessageStatus.Running, null));
    await connection.executeAsync(new SqlQuery("INSERT INTO messages (id, chatId, sequence, status, json, createdAt, updatedAt) VALUES ('m0', ?, 5, 'Completed', 'not json', 't', 't')",
      [chat.id]));
    const builder = new MigrationBuilder();

    migration.apply(builder);
    for (const operation of builder.toOperations())
      await connection.executeAsync(new SqlQuery(operation.render(new SQLiteDialect())));
    await host.messages.insertAsync(message("m2", 1, "Saved after the index"));
    const matching = async (phrase: string): Promise<string> => (await connection.queryAsync(new SqlQuery("SELECT m.id FROM messageText t JOIN messages m ON m.rowid = t.rowid "
      + "WHERE messageText MATCH ? ORDER BY m.id", [phrase]))).map(t => t.readString("id")).join(",");

    Assert.areEqual(6, builder.toOperations().length);
    Assert.areEqual(JSON.stringify(["m1,m2", "m1", "", "", ""]), JSON.stringify([await matching("\"saved\""), await matching("\"BEFORE\""), await matching("\"thought\""),
      await matching("\"not json\""), await matching("\"running\"")]));
  }
}
