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
import { CheckpointFoldersMigration } from "@noldova/teamrun.core";
import { Message, MessageAuthor, MessageStatus } from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class CheckpointFoldersMigrationTests {
  @TestMethod
  public async keepsTheFolderEachTurnRanInAndLeavesAnEarlierRowsFolderEmpty(): Promise<void> {
    const migration = new CheckpointFoldersMigration();
    const builder = new MigrationBuilder();
    migration.apply(builder);
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    for (const id of ["m1", "m2", "m3"])
      await host.messages.insertAsync(new Message(id, conversation.id, Number(id.slice(1)), MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t"));
    await host.context.database.connection.executeAsync(new SqlQuery("UPDATE messages SET checkpointId = 'earlier' WHERE id = 'm1'", []));
    await host.messages.setCheckpointFolderAsync("m2", "folder-a");
    await host.messages.setCheckpointAsync("m2", "later");
    await host.messages.setCheckpointFolderAsync("m3", "folder-b");

    Assert.areEqual("20261119120000_CheckpointFolders", migration.id);
    Assert.areEqual("ALTER TABLE messages ADD COLUMN checkpointFolderId TEXT", builder.toOperations().map(t => t.render(new SQLiteDialect())).join(";"));
    Assert.areEqual("earlier:none,later:folder-a,none:folder-b", (await Promise.all(["m1", "m2", "m3"].map(async t =>
      `${await host.messages.findCheckpointAsync(t) ?? "none"}:${await host.messages.findCheckpointFolderAsync(t) ?? "none"}`))).join(","));
    Assert.isNull(await host.messages.findCheckpointFolderAsync("gone"));
  }
}
