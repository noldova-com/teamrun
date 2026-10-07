/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { StayCause, StayedOpen } from "@noldova/teamrun-shell-protocol";

@TestClass
export class StayedOpenTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"cause\":\"SaveFailed\"}";

    Assert.areEqual(text, JSON.stringify(new StayedOpen(StayCause.SaveFailed).toJson()));
    Assert.areEqual(StayCause.Kept, StayedOpen.fromJson({ cause: "Kept" }).cause);
  }

  @TestMethod
  public rejectsAMissingOrUnknownCauseAndUnknownFields(): void {
    Assert.areEqual("$.cause", Assert.throws(() => StayedOpen.fromJson({}), JsonException).path);
    Assert.areEqual("$.cause", Assert.throws(() => StayedOpen.fromJson({ cause: "Quit" }), JsonException).path);
    Assert.areEqual("$.outcome", Assert.throws(() => StayedOpen.fromJson({ cause: "Kept", outcome: "Quit" }), JsonException).path);
  }
}
