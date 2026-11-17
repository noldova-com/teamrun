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
import {
  MessageDelivery,
  MessageSendParams,
  WaitingMessage,
  WaitingMessageAddParams,
  WaitingMessageEditParams,
  WaitingMessageIdParams,
  WaitingMessagesPayload
} from "@noldova/teamrun.protocol";

@TestClass
export class WaitingMessageTests {
  private static readonly send: MessageSendParams = new MessageSendParams("chat-1", "Next, the tests", null, null, [], [], "teammate-1");
  private static readonly json: object = { id: "waiting-1", chatId: "chat-1", delivery: "Queue", message: WaitingMessageTests.send.toJson(),
    createdAt: "2026-11-02T20:00:00.000Z" };

  @TestMethod
  public roundTripsThroughJsonWithItsSendDeliveryAndFailure(): void {
    const value = WaitingMessage.fromJson(WaitingMessageTests.json);
    const failed = WaitingMessage.fromJson({ ...WaitingMessageTests.json, failure: "The teammate was removed." });

    Assert.areEqual(JSON.stringify(WaitingMessageTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual(JSON.stringify({ ...WaitingMessageTests.json, failure: "The teammate was removed." }), JSON.stringify(failed.toJson()));
    Assert.areEqual("waiting-1|chat-1|Queue|Next, the tests|teammate-1|null", [value.id, value.chatId, value.delivery, value.message.text,
      value.message.responderTeammateId, String(value.failure)].join("|"));
  }

  @TestMethod
  public changesItsDeliveryKeepingAFailureAndItsSendClearingIt(): void {
    const failed = WaitingMessage.fromJson(WaitingMessageTests.json).withFailure("No provider.");
    const now = failed.withDelivery(MessageDelivery.StopAndSend);
    const edited = failed.withMessage(new MessageSendParams("chat-1", "Then the docs", null, null, [], [], "teammate-1"));

    Assert.areEqual("StopAndSend|No provider.|waiting-1", [now.delivery, now.failure, now.id].join("|"));
    Assert.areEqual("Queue|null|Then the docs|2026-11-02T20:00:00.000Z", [edited.delivery, String(edited.failure), edited.message.text, edited.createdAt].join("|"));
  }

  @TestMethod
  public rejectsInvalidArgumentsAndATeammatesSend(): void {
    const send = WaitingMessageTests.send;
    const time = "2026-11-02T20:00:00.000Z";

    Assert.throws(() => new WaitingMessage(" ", MessageDelivery.Queue, send, time), ArgumentException);
    Assert.throws(() => new WaitingMessage("waiting-1", MessageDelivery.Queue, send, String.empty), ArgumentException);
    Assert.throws(() => new WaitingMessage("waiting-1", MessageDelivery.Queue, send, time, " "), ArgumentException);
    const teammate = Assert.throws(() => new WaitingMessage("waiting-1", MessageDelivery.Steer,
      new MessageSendParams("chat-1", "Hi", null, null, [], [], null, "token-1"), time), ArgumentException);
    Assert.areEqual("message", teammate.parameterName);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const delivery = Assert.throws(() => WaitingMessage.fromJson({ ...WaitingMessageTests.json, delivery: "Later" }), JsonException);
    const failure = Assert.throws(() => WaitingMessage.fromJson({ ...WaitingMessageTests.json, failure: 3 }), JsonException);
    const text = Assert.throws(() => WaitingMessage.fromJson({ ...WaitingMessageTests.json, message: { ...WaitingMessageTests.send.toJson(), chatId: 4 } }),
      JsonException);

    Assert.areEqual("$.delivery,$.failure,$.message.chatId", [delivery.path, failure.path, text.path].join(","));
  }

  @TestMethod
  public listsAChatsWaitingMessagesOnlyOfThatChat(): void {
    const value = WaitingMessage.fromJson(WaitingMessageTests.json);
    const payload = WaitingMessagesPayload.fromJson(new WaitingMessagesPayload("chat-1", [value]).toJson());
    const other = new WaitingMessage("waiting-2", MessageDelivery.Queue, new MessageSendParams("chat-2", "Hi", null, null, [], [], "teammate-1"),
      "2026-11-02T20:00:00.000Z");

    Assert.areEqual("chat-1|waiting-1", [payload.chatId, ...payload.messages.map(t => t.id)].join("|"));
    Assert.areEqual(0, new WaitingMessagesPayload("chat-2", []).messages.length);
    Assert.throws(() => new WaitingMessagesPayload(" ", []), ArgumentException);
    Assert.areEqual("messages", Assert.throws(() => new WaitingMessagesPayload("chat-1", [value, other]), ArgumentException).parameterName);
  }

  @TestMethod
  public readsTheAddEditAndIdParameters(): void {
    const add = WaitingMessageAddParams.fromJson(new WaitingMessageAddParams(WaitingMessageTests.send, MessageDelivery.Steer).toJson());
    const edit = WaitingMessageEditParams.fromJson(new WaitingMessageEditParams("waiting-1", WaitingMessageTests.send).toJson());
    const id = WaitingMessageIdParams.fromJson(new WaitingMessageIdParams("waiting-1").toJson());

    Assert.areEqual("Steer|chat-1|waiting-1|Next, the tests|waiting-1", [add.delivery, add.message.chatId, edit.id, edit.message.text, id.id].join("|"));
    Assert.throws(() => new WaitingMessageEditParams(" ", WaitingMessageTests.send), ArgumentException);
    Assert.throws(() => new WaitingMessageIdParams(String.empty), ArgumentException);
    Assert.areEqual("$.delivery", Assert.throws(() => WaitingMessageAddParams.fromJson({ message: WaitingMessageTests.send.toJson(), delivery: 1 }),
      JsonException).path);
  }
}
