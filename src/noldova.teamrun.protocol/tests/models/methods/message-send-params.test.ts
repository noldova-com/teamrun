/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { MessageSendParams } from "@noldova/teamrun.protocol";

@TestClass
export class MessageSendParamsTests {
  private static readonly json: object = {
    chatId: "conv-1",
    text: "Add login",
    requested: { kind: "codex", model: null, effort: null, speed: null, mode: null },
    providerId: null,
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
      chatId: "conv-1", text: "", requested: { kind: "codex", model: null, effort: null, speed: null, mode: null }, providerId: null,
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

    Assert.throws(() => new MessageSendParams(String.empty, valid.text, valid.requested, valid.providerId), ArgumentException);
    Assert.throws(() => new MessageSendParams(valid.chatId, String.empty, valid.requested, valid.providerId), ArgumentException);
    Assert.throws(() => new MessageSendParams(valid.chatId, valid.text, valid.requested, " "), ArgumentException);
    Assert.doesNotThrow(() => new MessageSendParams(valid.chatId, valid.text, valid.requested, "acc-1"));
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
  public carriesTheSendingTurnsTokenAndRefusesASenderNamedAnyOtherWay(): void {
    const sent = new MessageSendParams("c", "Hi", null, null, [], [], "b", "token");

    Assert.areEqual("token", MessageSendParams.fromJson(sent.toJson()).senderToken);
    Assert.isNull(MessageSendParams.fromJson(MessageSendParamsTests.json).senderToken);
    Assert.areEqual("$.senderToken", Assert.throws(() => MessageSendParams.fromJson({ ...MessageSendParamsTests.json, senderToken: " " }), JsonException).path);
    Assert.areEqual("senderToken", Assert.throws(() => new MessageSendParams("c", "Hi", null, null, [], [], "b", " "), ArgumentException).parameterName);
    const forged = Assert.throws(() => MessageSendParams.fromJson({ ...MessageSendParamsTests.json, sender: { chatId: "c2", teammateId: "a" } }),
      ArgumentException);
    Assert.areEqual("sender", forged.parameterName);
  }

  @TestMethod
  public asksForAWakeOnlyFromASendingTurnAndWritesItOnlyWhenAsked(): void {
    const waking = new MessageSendParams("c", "Hi", null, null, [], [], "b", "token", true);

    Assert.isTrue(MessageSendParams.fromJson(waking.toJson()).wakeWhenDone);
    Assert.isTrue(waking.toJson()["wakeWhenDone"] === true);
    Assert.isFalse(Object.hasOwn(new MessageSendParams("c", "Hi", null, null, [], [], "b", "token").toJson(), "wakeWhenDone"));
    Assert.isFalse(MessageSendParams.fromJson({ ...MessageSendParamsTests.json, senderToken: "token", wakeWhenDone: false }).wakeWhenDone);
    Assert.isFalse(MessageSendParams.fromJson(MessageSendParamsTests.json).wakeWhenDone);
    Assert.areEqual("wakeWhenDone", Assert.throws(() => new MessageSendParams("c", "Hi", null, null, [], [], "b", null, true), ArgumentException)
      .parameterName);
    Assert.areEqual("wakeWhenDone", Assert.throws(() => MessageSendParams.fromJson({ ...MessageSendParamsTests.json, wakeWhenDone: true }),
      ArgumentException).parameterName);
    Assert.areEqual("$.wakeWhenDone", Assert.throws(() => MessageSendParams.fromJson({ ...MessageSendParamsTests.json, senderToken: "token",
      wakeWhenDone: "yes" }), JsonException).path);
  }

  @TestMethod
  public letsOnlyATeammatesSendNameNoOneWithoutSettings(): void {
    const unnamed = MessageSendParams.fromJson(new MessageSendParams("c", "Hi", null, null, [], [], null, "token").toJson());

    Assert.areEqual(["0", "true", "true", "token"].join(","),
      [String(unnamed.mentionedTeammateIds.length), String(Object.isNull(unnamed.responderTeammateId)), String(Object.isNull(unnamed.requested)), unnamed.senderToken]
        .join(","));
    Assert.areEqual("requested", Assert.throws(() => new MessageSendParams("c", "Hi", null, null), ArgumentException).parameterName);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => MessageSendParams.fromJson({ ...MessageSendParamsTests.json, requested: { model: null } }), JsonException);

    Assert.areEqual("$.requested.kind", exception.path);
  }
}
