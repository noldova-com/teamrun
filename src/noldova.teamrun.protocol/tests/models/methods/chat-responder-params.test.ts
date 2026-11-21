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
import { ChatResponder, ChatResponderParams } from "@noldova/teamrun.protocol";

@TestClass
export class ChatResponderParamsTests {
  @TestMethod
  public roundTripsAChoiceAndAClearedOneThroughJson(): void {
    const teammate = { teammateId: "bob", requested: null, providerId: null };
    const fallback = { teammateId: null, requested: { kind: "codex", model: null, effort: null, speed: null, mode: null }, providerId: "a1" };
    for (const json of [{ chatId: "conv-1", responder: teammate, chosen: true, start: false }, { chatId: "conv-1", responder: fallback, chosen: false, start: true },
      { chatId: "conv-1", responder: null, chosen: false, start: false }])
      Assert.areEqual(JSON.stringify(json), JSON.stringify(ChatResponderParams.fromJson(json).toJson()));
  }

  @TestMethod
  public readsAChoiceAsNotThePersonsWhenItDoesNotSay(): void {
    Assert.isFalse(ChatResponderParams.fromJson({ chatId: "conv-1", responder: null }).chosen);
    Assert.isFalse(new ChatResponderParams("conv-1", null).chosen);
    Assert.isTrue(new ChatResponderParams("conv-1", null, true).chosen);
  }

  @TestMethod
  public readsAResponderAsSetWhateverTheChatHoldsWhenItDoesNotAskToStartOne(): void {
    Assert.isFalse(ChatResponderParams.fromJson({ chatId: "conv-1", responder: null, chosen: true }).start);
    Assert.isFalse(new ChatResponderParams("conv-1", null, true).start);
    Assert.isTrue(new ChatResponderParams("conv-1", null, false, true).start);
    Assert.isTrue(ChatResponderParams.fromJson({ chatId: "conv-1", responder: null, start: true }).start);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new ChatResponderParams(String.empty, new ChatResponder("bob")), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    Assert.areEqual("$.responder", Assert.throws(() => ChatResponderParams.fromJson({ chatId: "conv-1" }), JsonException).path);
    Assert.areEqual("$.responder.requested.kind", Assert.throws(() => ChatResponderParams.fromJson({ chatId: "conv-1",
      responder: { teammateId: null, requested: {}, providerId: null } }), JsonException).path);
    Assert.areEqual("$.chatId", Assert.throws(() => ChatResponderParams.fromJson({ responder: null }), JsonException).path);
    Assert.areEqual("$.chosen", Assert.throws(() => ChatResponderParams.fromJson({ chatId: "conv-1", responder: null, chosen: 1 }), JsonException).path);
    Assert.areEqual("$.start", Assert.throws(() => ChatResponderParams.fromJson({ chatId: "conv-1", responder: null, start: 1 }), JsonException).path);
  }
}
