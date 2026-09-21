/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { MessageSendParams } from "@noldova/teamrun-protocol";

@TestClass
export class MessageSendParamsTests {
  private static readonly json: object = {
    conversationId: "conv-1",
    text: "Add login",
    requested: { provider: "codex", model: null, effort: null },
    providerAccountId: null,
    mentionedTeammateIds: [],
    responderTeammateId: null
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = MessageSendParams.fromJson(MessageSendParamsTests.json);

    Assert.areEqual(JSON.stringify(MessageSendParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public readsAnAttachmentOnlySendWithoutTeammateSelection(): void {
    const value = MessageSendParams.fromJson({
      conversationId: "conv-1", text: "", requested: { provider: "codex", model: null, effort: null }, providerAccountId: null,
      attachments: [{ name: "empty.txt", mediaType: "text/plain", data: "", path: null }]
    });

    Assert.areEqual("", value.text);
    Assert.areEqual("empty.txt", value.attachments[0]?.name);
    Assert.areEqual(0, value.mentionedTeammateIds.length);
    Assert.isNull(value.responderTeammateId);
    Assert.areEqual(1, MessageSendParams.fromJson(value.toJson()).attachments.length);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const valid = MessageSendParams.fromJson(MessageSendParamsTests.json);

    Assert.throws(() => new MessageSendParams(String.empty, valid.text, valid.requested, valid.providerAccountId), ArgumentException);
    Assert.throws(() => new MessageSendParams(valid.conversationId, String.empty, valid.requested, valid.providerAccountId), ArgumentException);
    Assert.throws(() => new MessageSendParams(valid.conversationId, valid.text, valid.requested, " "), ArgumentException);
    Assert.doesNotThrow(() => new MessageSendParams(valid.conversationId, valid.text, valid.requested, "acc-1"));
    Assert.throws(() => new MessageSendParams("c", "text", null, null), ArgumentException);
    Assert.throws(() => new MessageSendParams("c", "text", null, null, [], [" "]), ArgumentException);
    Assert.throws(() => new MessageSendParams("c", "text", null, null, [], [], " "), ArgumentException);
    const named = new MessageSendParams("c", "@Alice", null, null, [], ["a"], "b");
    const copy = MessageSendParams.fromJson(named.toJson());
    Assert.isNull(copy.requested);
    Assert.areEqual("a", copy.mentionedTeammateIds[0]);
    Assert.areEqual("b", copy.responderTeammateId);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => MessageSendParams.fromJson({ ...MessageSendParamsTests.json, requested: { model: null } }), JsonException);

    Assert.areEqual("$.requested.provider", exception.path);
  }
}
