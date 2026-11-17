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
import { ChatMember, ChatMemberSettings } from "@noldova/teamrun.protocol";

@TestClass
export class ChatMemberTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const value = new ChatMember("conversationId-1", "teammateId-1", "2026-09-15T00:00:00Z", "native-1", true);
    const json = value.toJson();
    Assert.areEqual(JSON.stringify(json), JSON.stringify(ChatMember.fromJson(json).toJson()));
    Assert.isNull(ChatMember.fromJson(new ChatMember("conversationId-1",
      "teammateId-1",
      "2026-09-15T00:00:00Z",
      null,
      false).toJson()).nativeSessionId);
    Assert.areEqual("$.input.chatId", Assert.throws(() => ChatMember.fromJson({ ...json, chatId: 42 }, "$.input"), JsonException).path);
    Assert.areEqual("next", value.withSession("next", true).nativeSessionId);
    Assert.isFalse(value.withSession(null, false).resumedNativeSession);
    Assert.throws(() => value.withSession(null, true), ArgumentException);
  }

  @TestMethod
  public keepsItsOwnModeForTheChatThroughASessionChangeAndReadsOneStoredWithoutAsNone(): void {
    const value = new ChatMember("chat-1", "teammate-1", "2026-10-25T00:00:00Z", "native-1", true).withMode("plan");
    const { mode: _mode, ...stored } = value.toJson();

    Assert.areEqual("plan", ChatMember.fromJson(value.toJson()).mode);
    Assert.areEqual("plan", value.withSession(null, false).mode);
    Assert.isNull(value.withMode(null).mode);
    Assert.isNull(ChatMember.fromJson(stored).mode);
    Assert.isNull(new ChatMember("chat-1", "teammate-1", "2026-10-25T00:00:00Z", null, false).mode);
    Assert.areEqual("$.mode", Assert.throws(() => ChatMember.fromJson({ ...stored, mode: 3 }), JsonException).path);
    Assert.areEqual("mode", Assert.throws(() => value.withMode(" "), ArgumentException).parameterName);
  }

  @TestMethod
  public keepsItsOwnModelAndEffortForTheChatThroughASessionOrModeChangeAndReadsOneStoredWithoutAsTheTeammates(): void {
    const value = new ChatMember("chat-1", "teammate-1", "2026-11-04T00:00:00Z", "native-1", true).withSettings(new ChatMemberSettings(null, "high"));
    const { settings: _settings, ...stored } = value.toJson();

    Assert.areEqual(JSON.stringify({ model: null, effort: "high", speed: null }), JSON.stringify(ChatMember.fromJson(value.toJson()).settings?.toJson()));
    Assert.areEqual("high", value.withSession(null, false).withMode("plan").settings?.effort);
    Assert.isNull(value.withSettings(null).settings);
    Assert.isNull(ChatMember.fromJson(stored).settings);
    Assert.isNull(ChatMember.fromJson({ ...stored, settings: null }).settings);
    Assert.isNull(new ChatMember("chat-1", "teammate-1", "2026-11-04T00:00:00Z", null, false).settings);
    Assert.areEqual("$.settings.effort", Assert.throws(() => ChatMember.fromJson({ ...stored, settings: { model: null, effort: 3 } }), JsonException).path);
    Assert.areEqual("$.settings", Assert.throws(() => ChatMember.fromJson({ ...stored, settings: "high" }), JsonException).path);
  }

  @TestMethod
  public keepsTheAccountItsSessionRunsOnThroughAModeOrSettingsChangeAndDropsItWithTheSession(): void {
    const value = new ChatMember("chat-1", "teammate-1", "2026-11-12T00:00:00Z", "native-1", true).withSession("native-2", false, "spare");
    const { sessionProviderId: _account, ...stored } = value.toJson();

    Assert.areEqual("spare", ChatMember.fromJson(value.toJson()).sessionProviderId);
    Assert.areEqual("spare", value.withMode("plan").withSettings(new ChatMemberSettings(null, "high")).sessionProviderId);
    Assert.isNull(value.withSession("native-3", false).sessionProviderId);
    Assert.isNull(ChatMember.fromJson(stored).sessionProviderId);
    Assert.areEqual("$.sessionProviderId", Assert.throws(() => ChatMember.fromJson({ ...stored, sessionProviderId: 3 }), JsonException).path);
    Assert.areEqual("sessionProviderId", Assert.throws(() => new ChatMember("chat-1", "teammate-1", "2026-11-12T00:00:00Z", null, false, null, null, "spare"),
      ArgumentException).parameterName);
    Assert.areEqual("sessionProviderId", Assert.throws(() => new ChatMember("chat-1", "teammate-1", "2026-11-12T00:00:00Z", "native-1", false, null, null, " "),
      ArgumentException).parameterName);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.throws(() => new ChatMember(" ", "teammateId-1", "2026-09-15T00:00:00Z", "native-1", true), ArgumentException);
    Assert.throws(() => new ChatMember("conversationId-1", " ", "2026-09-15T00:00:00Z", "native-1", true), ArgumentException);
    Assert.throws(() => new ChatMember("conversationId-1", "teammateId-1", " ", "native-1", true), ArgumentException);
    Assert.throws(() => new ChatMember("conversationId-1", "teammateId-1", "2026-09-15T00:00:00Z", " ", true), ArgumentException);
  }
}
