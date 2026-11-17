/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DefaultTeammateSetParams } from "@noldova/teamrun.protocol";

@TestClass
export class DefaultTeammateSetParamsTests {
  @TestMethod
  public roundTripsADefaultTeammateAndAClearedOneThroughJson(): void {
    const chosen = { requested: { kind: "codex", model: "gpt-5", effort: null, speed: null, mode: null }, providerId: "a1" };
    for (const json of [{ defaultTeammate: chosen }, { defaultTeammate: null }])
      Assert.areEqual(JSON.stringify(json), JSON.stringify(DefaultTeammateSetParams.fromJson(json).toJson()));
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    Assert.areEqual("$.defaultTeammate", Assert.throws(() => DefaultTeammateSetParams.fromJson({}), JsonException).path);
    Assert.areEqual("$.defaultTeammate.requested.kind",
      Assert.throws(() => DefaultTeammateSetParams.fromJson({ defaultTeammate: { requested: { model: null }, providerId: null } }), JsonException).path);
  }
}
