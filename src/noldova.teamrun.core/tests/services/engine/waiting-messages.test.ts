/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { SqlQuery } from "@noldova/context.data.sql";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChatIdParams, MessageDelivery, MessageSendParams, RequestedSettings, WaitingMessage } from "@noldova/teamrun.protocol";
import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class WaitingMessagesTests {
  @TestMethod
  public async deletesAChatsWaitingMessagesWithTheChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const gone = new WaitingMessage("waiting-1", MessageDelivery.Queue, await WaitingMessagesTests.paramsAsync(host, chat.id, "Gone"), "t");
    await host.context.database.connection.executeAsync(new SqlQuery("INSERT INTO waitingMessages (id, chatId, json, updatedAt) VALUES (?, ?, ?, 't')",
      [gone.id, chat.id, JSON.stringify(gone.toJson())]));

    await host.conversations.deleteAsync(new ChatIdParams(chat.id));

    Assert.areEqual(0, (await host.context.database.connection.queryAsync(new SqlQuery("SELECT id FROM waitingMessages"))).length);
  }

  private static async paramsAsync(host: CoreHost, chatId: string, text: string): Promise<MessageSendParams> {
    return new MessageSendParams(chatId, text, new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id);
  }
}
