/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { QuitReport, QuitResult } from "@noldova/teamrun-shell-protocol";

@TestClass
export class QuitReportTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"outcome\":\"NoDesktop\"}";

    Assert.areEqual(text, JSON.stringify(new QuitReport(QuitResult.NoDesktop).toJson()));
    Assert.areEqual(QuitResult.Quit, QuitReport.fromJson({ outcome: "Quit" }).outcome);
  }

  @TestMethod
  public rejectsAMissingOrUnknownOutcomeAndUnknownFields(): void {
    Assert.areEqual("$.outcome", Assert.throws(() => QuitReport.fromJson({}), JsonException).path);
    Assert.areEqual("$.outcome", Assert.throws(() => QuitReport.fromJson({ outcome: "Stayed" }), JsonException).path);
    Assert.areEqual("$.cause", Assert.throws(() => QuitReport.fromJson({ outcome: "Quit", cause: "Kept" }), JsonException).path);
  }
}
