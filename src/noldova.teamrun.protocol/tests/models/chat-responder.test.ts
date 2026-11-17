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
import { ChatResponder, RequestedSettings } from "@noldova/teamrun.protocol";

@TestClass
export class ChatResponderTests {
  @TestMethod
  public holdsATeammateOrTheDefaultTeammatesSettingsWithAProvider(): void {
    const teammate = new ChatResponder("bob");
    const fallback = new ChatResponder(null, new RequestedSettings("codex", "gpt-5", null), "a1");

    Assert.areEqual(JSON.stringify({ teammateId: "bob", requested: null, providerId: null }), JSON.stringify(teammate.toJson()));
    Assert.areEqual(JSON.stringify(fallback.toJson()), JSON.stringify(ChatResponder.fromJson(fallback.toJson()).toJson()));
    Assert.isNull(new ChatResponder(null, new RequestedSettings("codex", null, null)).providerId);
  }

  @TestMethod
  public refusesBothNeitherOrAProviderForATeammate(): void {
    const settings = new RequestedSettings("codex", null, null);

    for (const make of [() => new ChatResponder(null), () => new ChatResponder("bob", settings), () => new ChatResponder("bob", null, "a1"),
      () => new ChatResponder(" "), () => new ChatResponder(null, settings, " ")])
      Assert.throws(make, ArgumentException);
    for (const json of [{ teammateId: null, requested: null, providerId: null },
      { teammateId: "bob", requested: settings.toJson(), providerId: null }, { teammateId: "bob", requested: null, providerId: "a1" }])
      Assert.areEqual("$", Assert.throws(() => ChatResponder.fromJson(json), JsonException).path);
  }
}
