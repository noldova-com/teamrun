/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Chat, ChatRewindResult } from "@noldova/teamrun.protocol";

@TestClass
export class ChatRewindResultTests {
  private static readonly json: object = {
    chat: { id: "conv-1", projectId: "prj-1", title: "Add login", createdAt: "t1", updatedAt: "t2", sessionReset: true, forkedSession: null, responder: null, edited: false, folder: null },
    removedMessageIds: ["msg-4", "msg-5"],
    restoredFiles: 3,
    sessionKept: true,
    restoreRefusal: null
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ChatRewindResult.fromJson(ChatRewindResultTests.json);

    Assert.areEqual(JSON.stringify(ChatRewindResultTests.json), JSON.stringify(value.toJson()));
    Assert.isTrue(value.chat.sessionReset);
    Assert.areEqual("msg-4,msg-5", value.removedMessageIds.join(","));
    Assert.areEqual(3, value.restoredFiles);
    Assert.isNull(ChatRewindResult.fromJson({ ...ChatRewindResultTests.json, restoredFiles: null }).restoredFiles);
    Assert.areEqual(0, new ChatRewindResult(value.chat, [], null).removedMessageIds.length);
    Assert.isTrue(value.chat instanceof Chat);
    Assert.isTrue(value.sessionKept);
    Assert.isFalse(ChatRewindResult.fromJson({ ...ChatRewindResultTests.json, sessionKept: undefined }).sessionKept);
    Assert.isFalse(new ChatRewindResult(value.chat, [], null).sessionKept);
  }

  @TestMethod
  public carriesWhyNoFilesWereRestored(): void {
    const refused = { ...ChatRewindResultTests.json, restoredFiles: null, restoreRefusal: "Another program changed the files since." };

    const value = ChatRewindResult.fromJson(refused);

    Assert.areEqual("Another program changed the files since.", value.restoreRefusal);
    Assert.areEqual(JSON.stringify(refused), JSON.stringify(value.toJson()));
    Assert.isNull(ChatRewindResult.fromJson({ ...ChatRewindResultTests.json, restoreRefusal: undefined }).restoreRefusal);
    Assert.isNull(new ChatRewindResult(value.chat, [], null).restoreRefusal);
    Assert.areEqual("$.restoreRefusal",
      Assert.throws(() => ChatRewindResult.fromJson({ ...ChatRewindResultTests.json, restoreRefusal: 1 }), JsonException).path);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const badIds = Assert.throws(() => ChatRewindResult.fromJson({ ...ChatRewindResultTests.json, removedMessageIds: "x" }), JsonException);
    const badChat = Assert.throws(() => ChatRewindResult.fromJson({ ...ChatRewindResultTests.json, chat: { id: "c" } }), JsonException);

    Assert.areEqual("$.removedMessageIds", badIds.path);
    Assert.areEqual("$.chat.projectId", badChat.path);
  }
}
