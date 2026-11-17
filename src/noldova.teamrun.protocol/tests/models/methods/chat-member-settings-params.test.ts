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
import { ChatMemberSettings, ChatMemberSettingsParams } from "@noldova/teamrun.protocol";

@TestClass
export class ChatMemberSettingsParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const value = new ChatMemberSettingsParams("chat-1", "teammate-1", new ChatMemberSettings("gpt-6", "medium", "fast"));
    const json = value.toJson();

    Assert.areEqual(JSON.stringify({ chatId: "chat-1", teammateId: "teammate-1", settings: { model: "gpt-6", effort: "medium", speed: "fast" } }),
      JSON.stringify(ChatMemberSettingsParams.fromJson(json).toJson()));
    Assert.isNull(ChatMemberSettingsParams.fromJson({ ...json, settings: null }).settings);
    Assert.areEqual(JSON.stringify({ chatId: "chat-1", teammateId: "teammate-1", settings: null }),
      JSON.stringify(new ChatMemberSettingsParams("chat-1", "teammate-1", null).toJson()));
    Assert.areEqual(JSON.stringify({ model: null, effort: null, speed: null }),
      JSON.stringify(ChatMemberSettingsParams.fromJson({ ...json, settings: { model: null, effort: null } }).settings?.toJson()));
    Assert.areEqual("$.input.settings.model",
      Assert.throws(() => ChatMemberSettingsParams.fromJson({ ...json, settings: { model: 3, effort: null } }, "$.input"), JsonException).path);
    Assert.areEqual("$.settings", Assert.throws(() => ChatMemberSettingsParams.fromJson({ chatId: "chat-1", teammateId: "teammate-1" }), JsonException).path);
    Assert.areEqual("$.teammateId", Assert.throws(() => ChatMemberSettingsParams.fromJson({ chatId: "chat-1", settings: null }), JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.areEqual("chatId", Assert.throws(() => new ChatMemberSettingsParams(" ", "teammate-1", null), ArgumentException).parameterName);
    Assert.areEqual("teammateId", Assert.throws(() => new ChatMemberSettingsParams("chat-1", " ", null), ArgumentException).parameterName);
    Assert.areEqual("model", Assert.throws(() => new ChatMemberSettings(" ", null), ArgumentException).parameterName);
    Assert.areEqual("effort", Assert.throws(() => new ChatMemberSettings(null, " "), ArgumentException).parameterName);
    Assert.areEqual("speed", Assert.throws(() => new ChatMemberSettings(null, null, " "), ArgumentException).parameterName);
  }
}
