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
import { DefaultTeammate, RequestedSettings } from "@noldova/teamrun.protocol";

@TestClass
export class DefaultTeammateTests {
  @TestMethod
  public holdsTheSettingsANewChatStartsWithAndItsProviderWhenOneIsChosen(): void {
    const chosen = { requested: { kind: "codex", model: "gpt-5", effort: "high", speed: "priority", mode: "plan" }, providerId: "a1" };
    const unchosen = { requested: { kind: "claude", model: null, effort: null, speed: null, mode: null }, providerId: null };

    for (const json of [chosen, unchosen])
      Assert.areEqual(JSON.stringify(json), JSON.stringify(DefaultTeammate.fromJson(json).toJson()));
    Assert.isNull(new DefaultTeammate(new RequestedSettings("codex", null, null)).providerId);
  }

  @TestMethod
  public rejectsABlankProviderAndMissingSettings(): void {
    Assert.throws(() => new DefaultTeammate(new RequestedSettings("codex", null, null), " "), ArgumentException);
    Assert.areEqual("$.requested", Assert.throws(() => DefaultTeammate.fromJson({ providerId: "a1" }), JsonException).path);
  }
}
