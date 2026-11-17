/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ReadingPositionsService } from "@noldova/teamrun.core";
import { ConversationPosition, ReadingPositionSaveParams } from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class ReadingPositionsServiceTests {
  @TestMethod
  public async keepsOnePositionPerConversationAndReplacesItOnTheNextSave(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const service = new ReadingPositionsService(host.context);

    await service.saveAsync(new ReadingPositionSaveParams([new ConversationPosition(conversation.id, "m1", 0, 40)]));
    await service.saveAsync(new ReadingPositionSaveParams([new ConversationPosition(conversation.id, "m3", 2, -12.5)]));

    Assert.areEqual(JSON.stringify([new ConversationPosition(conversation.id, "m3", 2, -12.5).toJson()]), JSON.stringify((await service.listAsync()).map(t => t.toJson())));
  }

  @TestMethod
  public async clearsAConversationsPositionAndSkipsOneWhoseConversationIsGone(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const [left, cleared] = [await host.createConversationAsync(), await host.createConversationAsync()];
    const service = new ReadingPositionsService(host.context);
    await service.saveAsync(new ReadingPositionSaveParams([new ConversationPosition(left.id, "m1", 0, 0), new ConversationPosition(cleared.id, "m2", 1, 0)]));

    await service.saveAsync(new ReadingPositionSaveParams([new ConversationPosition("missing", "m1", 0, 0)], [cleared.id, "also-missing"]));

    Assert.areEqual([left.id].join(), (await service.listAsync()).map(t => t.conversationId).join());
  }

  @TestMethod
  public async dropsAPositionOnlyWhileItStillNamesTheGoneMessage(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const [moved, stale] = [await host.createConversationAsync(), await host.createConversationAsync()];
    const service = new ReadingPositionsService(host.context);
    await service.saveAsync(new ReadingPositionSaveParams([new ConversationPosition(moved.id, "m30", 30, 0), new ConversationPosition(stale.id, "m4", 4, 0)]));

    await service.saveAsync(new ReadingPositionSaveParams([], [], [new ConversationPosition(moved.id, "m20", 20, 0), new ConversationPosition(stale.id, "m4", 4, 0)]));

    Assert.areEqual(`${moved.id}:m30`, (await service.listAsync()).map(t => `${t.conversationId}:${t.messageId}`).join());
  }

  @TestMethod
  public async listsNothingBeforeTheFirstSave(): Promise<void> {
    await using host = await CoreHost.createAsync();

    Assert.areEqual(0, (await new ReadingPositionsService(host.context).listAsync()).length);
  }
}
