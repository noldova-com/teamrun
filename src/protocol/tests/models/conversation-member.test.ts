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
import { ConversationMember } from "@noldova/teamrun-protocol";

@TestClass
export class ConversationMemberTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const value = new ConversationMember("conversationId-1", "teammateId-1", "2026-09-15T00:00:00Z", "native-1", true);
    const json = value.toJson();
    Assert.areEqual(JSON.stringify(json), JSON.stringify(ConversationMember.fromJson(json).toJson()));
    Assert.isNull(ConversationMember.fromJson(new ConversationMember("conversationId-1",
      "teammateId-1",
      "2026-09-15T00:00:00Z",
      null,
      false).toJson()).nativeSessionId);
    Assert.areEqual("$.input.conversationId", Assert.throws(() => ConversationMember.fromJson({ ...json, conversationId: 42 }, "$.input"), JsonException).path);
    Assert.areEqual("next", value.withSession("next", true).nativeSessionId);
    Assert.isFalse(value.withSession(null, false).resumedNativeSession);
    Assert.throws(() => value.withSession(null, true), ArgumentException);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.throws(() => new ConversationMember(" ", "teammateId-1", "2026-09-15T00:00:00Z", "native-1", true), ArgumentException);
    Assert.throws(() => new ConversationMember("conversationId-1", " ", "2026-09-15T00:00:00Z", "native-1", true), ArgumentException);
    Assert.throws(() => new ConversationMember("conversationId-1", "teammateId-1", " ", "native-1", true), ArgumentException);
    Assert.throws(() => new ConversationMember("conversationId-1", "teammateId-1", "2026-09-15T00:00:00Z", " ", true), ArgumentException);
  }
}
