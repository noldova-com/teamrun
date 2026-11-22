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
import { MessageSendAbandonedPayload, MessageSendingPayload } from "@noldova/teamrun.protocol";

@TestClass
export class MessageSendingPayloadTests {
  private static readonly json: object = { sendId: "send-1", chatId: "conv-1", teammateId: "grok", toChatId: "conv-2" };

  @TestMethod
  public roundTripsThroughJsonWithTheSendTheChatsAndTheTeammate(): void {
    const value = MessageSendingPayload.fromJson(MessageSendingPayloadTests.json);
    const abandoned = MessageSendAbandonedPayload.fromJson({ sendId: "send-1" });

    Assert.areEqual(JSON.stringify(MessageSendingPayloadTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual("send-1:conv-1:grok:conv-2", [value.sendId, value.chatId, value.teammateId, value.toChatId].join(":"));
    Assert.areEqual('{"sendId":"send-1"}', JSON.stringify(abandoned.toJson()));
  }

  @TestMethod
  public rejectsBlankArguments(): void {
    const names = [
      () => new MessageSendingPayload(" ", "conv-1", "grok", "conv-2"), () => new MessageSendingPayload("send-1", " ", "grok", "conv-2"),
      () => new MessageSendingPayload("send-1", "conv-1", " ", "conv-2"), () => new MessageSendingPayload("send-1", "conv-1", "grok", " "),
      () => new MessageSendAbandonedPayload(" ")
    ].map(t => Assert.throws(t, ArgumentException).parameterName);

    Assert.areEqual("sendId,chatId,teammateId,toChatId,sendId", names.join(","));
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const paths = [
      Assert.throws(() => MessageSendingPayload.fromJson({ ...MessageSendingPayloadTests.json, sendId: 1 }), JsonException),
      Assert.throws(() => MessageSendingPayload.fromJson({ ...MessageSendingPayloadTests.json, chatId: "" }), JsonException),
      Assert.throws(() => MessageSendingPayload.fromJson({ ...MessageSendingPayloadTests.json, teammateId: null }), JsonException),
      Assert.throws(() => MessageSendingPayload.fromJson({ ...MessageSendingPayloadTests.json, toChatId: " " }, "$.payload"), JsonException),
      Assert.throws(() => MessageSendAbandonedPayload.fromJson({}), JsonException)
    ].map(t => t.path);

    Assert.areEqual("$.sendId,$.chatId,$.teammateId,$.payload.toChatId,$.sendId", paths.join(","));
  }
}
