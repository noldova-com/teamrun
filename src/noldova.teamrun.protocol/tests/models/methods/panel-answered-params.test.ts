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
import { PanelAnsweredParams, PanelOutcome } from "@noldova/teamrun.protocol";

@TestClass
export class PanelAnsweredParamsTests {
  private static readonly json: object = { requestId: "request-1", windowId: "window-1", outcome: "Refused" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = PanelAnsweredParams.fromJson(PanelAnsweredParamsTests.json);

    Assert.areEqual(JSON.stringify(PanelAnsweredParamsTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual(PanelOutcome.Refused, value.outcome);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new PanelAnsweredParams(String.empty, "window-1", PanelOutcome.Done), ArgumentException);
    Assert.throws(() => new PanelAnsweredParams("request-1", " ", PanelOutcome.Done), ArgumentException);
    Assert.throws(() => new PanelAnsweredParams("request-1", "window-1", "Later" as PanelOutcome), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    Assert.areEqual("$.requestId", Assert.throws(() => PanelAnsweredParams.fromJson({ requestId: 4 }), JsonException).path);
    Assert.areEqual("$.outcome", Assert.throws(() => PanelAnsweredParams.fromJson({ requestId: "r", windowId: "w", outcome: "Later" }), JsonException).path);
  }
}
