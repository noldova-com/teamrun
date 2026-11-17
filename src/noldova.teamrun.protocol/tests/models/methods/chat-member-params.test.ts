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
import { ChatMemberParams } from "@noldova/teamrun.protocol";

@TestClass
export class ChatMemberParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const value = new ChatMemberParams("conversationId-1", "teammateId-1");
    const json = value.toJson();
    Assert.areEqual(JSON.stringify(json), JSON.stringify(ChatMemberParams.fromJson(json).toJson()));
    Assert.areEqual("$.input.chatId",
      Assert.throws(() => ChatMemberParams.fromJson({ ...json,
      chatId: 42 },
      "$.input"),
      JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.throws(() => new ChatMemberParams(" ", "teammateId-1"), ArgumentException);
    Assert.throws(() => new ChatMemberParams("conversationId-1", " "), ArgumentException);
  }
}
