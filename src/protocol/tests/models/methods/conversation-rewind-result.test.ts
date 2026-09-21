/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Conversation, ConversationRewindResult } from "@noldova/teamrun-protocol";

@TestClass
export class ConversationRewindResultTests {
  private static readonly json: object = {
    conversation: { id: "conv-1", projectId: "prj-1", title: "Add login", createdAt: "t1", updatedAt: "t2", sessionReset: true, forkedSession: null },
    removedMessageIds: ["msg-4", "msg-5"],
    restoredFiles: 3,
    sessionKept: true
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ConversationRewindResult.fromJson(ConversationRewindResultTests.json);

    Assert.areEqual(JSON.stringify(ConversationRewindResultTests.json), JSON.stringify(value.toJson()));
    Assert.isTrue(value.conversation.sessionReset);
    Assert.areEqual("msg-4,msg-5", value.removedMessageIds.join(","));
    Assert.areEqual(3, value.restoredFiles);
    Assert.isNull(ConversationRewindResult.fromJson({ ...ConversationRewindResultTests.json, restoredFiles: null }).restoredFiles);
    Assert.areEqual(0, new ConversationRewindResult(value.conversation, [], null).removedMessageIds.length);
    Assert.isTrue(value.conversation instanceof Conversation);
    Assert.isTrue(value.sessionKept);
    Assert.isFalse(ConversationRewindResult.fromJson({ ...ConversationRewindResultTests.json, sessionKept: undefined }).sessionKept);
    Assert.isFalse(new ConversationRewindResult(value.conversation, [], null).sessionKept);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const badIds = Assert.throws(() => ConversationRewindResult.fromJson({ ...ConversationRewindResultTests.json, removedMessageIds: "x" }), JsonException);
    const badConversation = Assert.throws(() => ConversationRewindResult.fromJson({ ...ConversationRewindResultTests.json, conversation: { id: "c" } }), JsonException);

    Assert.areEqual("$.removedMessageIds", badIds.path);
    Assert.areEqual("$.conversation.projectId", badConversation.path);
  }
}
