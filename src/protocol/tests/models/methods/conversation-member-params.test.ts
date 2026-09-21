/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ConversationMemberParams } from "@noldova/teamrun-protocol";

@TestClass
export class ConversationMemberParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const value = new ConversationMemberParams("conversationId-1", "teammateId-1");
    const json = value.toJson();
    Assert.areEqual(JSON.stringify(json), JSON.stringify(ConversationMemberParams.fromJson(json).toJson()));
    Assert.areEqual("$.input.conversationId",
      Assert.throws(() => ConversationMemberParams.fromJson({ ...json,
      conversationId: 42 },
      "$.input"),
      JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.throws(() => new ConversationMemberParams(" ", "teammateId-1"), ArgumentException);
    Assert.throws(() => new ConversationMemberParams("conversationId-1", " "), ArgumentException);
  }
}
