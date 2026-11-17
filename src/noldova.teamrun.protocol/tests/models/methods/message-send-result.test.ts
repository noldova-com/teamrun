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
import { MessageSendResult } from "@noldova/teamrun.protocol";

@TestClass
export class MessageSendResultTests {
  private static readonly userMessage: object = {
    id: "msg-1",
    chatId: "conv-1",
    sequence: 0,
    author: "User",
    inReplyTo: null,
    status: "Completed",
    details: [],
    provenance: null,
    createdAt: "t",
    startedAt: null,
    endedAt: "t"
  };
  private static readonly replyMessage: object = {
    id: "msg-2", chatId: "conv-1", sequence: 1, author: "Provider", inReplyTo: "msg-1", status: "Pending", details: [],
    provenance: {
      providerId: null,
      requested: { kind: "codex", model: null, effort: null, speed: null, mode: null },
      observed: { kind: null, model: null, effort: null, harnessVersion: null, unavailableModel: false, speed: null, speedUnavailable: null },
      nativeSessionId: null,
      resumedNativeSession: false,
      nativeTurnId: null
    },
    createdAt: "t", startedAt: null, endedAt: null
  };
  private static readonly json: object = { sent: MessageSendResultTests.userMessage, replies: [MessageSendResultTests.replyMessage] };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = MessageSendResult.fromJson(MessageSendResultTests.json);

    Assert.areEqual(JSON.stringify(MessageSendResultTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public representsASendWithNoReplies(): void {
    const result = MessageSendResult.fromJson({ sent: MessageSendResultTests.userMessage, replies: [] });

    Assert.areEqual(0, result.replies.length);
    Assert.isFalse(Object.hasOwn(result.toJson(), "reply"));
    Assert.areEqual(0, MessageSendResult.fromJson(result.toJson()).replies.length);
  }

  @TestMethod
  public carriesTheWakeItRecordedAndOmitsNone(): void {
    const woken = MessageSendResult.fromJson({ ...MessageSendResultTests.json, wakeId: "w1" });

    Assert.areEqual("w1", woken.wakeId);
    Assert.areEqual(JSON.stringify({ ...MessageSendResultTests.json, wakeId: "w1" }), JSON.stringify(woken.toJson()));
    Assert.isNull(MessageSendResult.fromJson(MessageSendResultTests.json).wakeId);
    Assert.isFalse(Object.hasOwn(MessageSendResult.fromJson(MessageSendResultTests.json).toJson(), "wakeId"));
    Assert.areEqual("$.wakeId", Assert.throws(() => MessageSendResult.fromJson({ ...MessageSendResultTests.json, wakeId: " " }), JsonException).path);
    Assert.areEqual("wakeId", Assert.throws(() => new MessageSendResult(woken.sent, [], " "), ArgumentException).parameterName);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => MessageSendResult.fromJson({ ...MessageSendResultTests.json, replies: [{ id: "msg-2" }] }), JsonException);

    Assert.areEqual("$.replies.0.chatId", exception.path);
  }
}
