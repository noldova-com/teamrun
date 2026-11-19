/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MigrationBuilder } from "@noldova/context.data.sql";
import { SQLiteDialect } from "@noldova/context.data.sql.sqlite";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ReplyCheckpointsMigration } from "@noldova/teamrun.core";
import { Message, MessageAuthor, MessageStatus } from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class ReplyCheckpointsMigrationTests {
  @TestMethod
  public async givesEachMessageACheckpointIdThatEarlierMessagesLack(): Promise<void> {
    const migration = new ReplyCheckpointsMigration();
    Assert.areEqual("20261023220000_ReplyCheckpoints", migration.id);
    const builder = new MigrationBuilder();
    migration.apply(builder);
    const statements = builder.toOperations().map(t => t.render(new SQLiteDialect()));
    Assert.areEqual("ALTER TABLE messages ADD COLUMN checkpointId TEXT", statements.join(";"));

    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    for (const id of ["m1", "m2"])
      await host.messages.insertAsync(new Message(id, conversation.id, id === "m1" ? 0 : 1, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t"));
    await host.messages.setCheckpointAsync("m2", "00000000-0000-7000-8000-000000000001", conversation.id);

    Assert.isNull(await host.messages.findCheckpointAsync("m1"));
    Assert.areEqual("00000000-0000-7000-8000-000000000001", await host.messages.findCheckpointAsync("m2"));
    Assert.isNull(await host.messages.findCheckpointAsync("gone"));
  }
}
