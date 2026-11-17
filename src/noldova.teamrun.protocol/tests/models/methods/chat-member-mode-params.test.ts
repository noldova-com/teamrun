/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChatMemberModeParams } from "@noldova/teamrun.protocol";

@TestClass
export class ChatMemberModeParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const value = new ChatMemberModeParams("chat-1", "teammate-1", "plan");
    const json = value.toJson();

    Assert.areEqual(JSON.stringify({ chatId: "chat-1", teammateId: "teammate-1", mode: "plan" }), JSON.stringify(ChatMemberModeParams.fromJson(json).toJson()));
    Assert.isNull(ChatMemberModeParams.fromJson({ ...json, mode: null }).mode);
    Assert.areEqual("$.input.mode", Assert.throws(() => ChatMemberModeParams.fromJson({ ...json, mode: 3 }, "$.input"), JsonException).path);
    Assert.areEqual("$.teammateId", Assert.throws(() => ChatMemberModeParams.fromJson({ chatId: "chat-1", mode: null }), JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.areEqual("chatId", Assert.throws(() => new ChatMemberModeParams(" ", "teammate-1", null), ArgumentException).parameterName);
    Assert.areEqual("teammateId", Assert.throws(() => new ChatMemberModeParams("chat-1", " ", null), ArgumentException).parameterName);
    Assert.areEqual("mode", Assert.throws(() => new ChatMemberModeParams("chat-1", "teammate-1", " "), ArgumentException).parameterName);
  }
}
