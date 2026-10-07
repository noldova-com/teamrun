/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { QuitAnswer, QuitAnswered } from "@noldova/teamrun-shell-protocol";

@TestClass
export class QuitAnsweredTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"answer\":\"SaveFailed\"}";

    Assert.areEqual(text, JSON.stringify(new QuitAnswered(QuitAnswer.SaveFailed).toJson()));
    Assert.areEqual(QuitAnswer.Stayed, QuitAnswered.fromJson({ answer: "Stayed" }).answer);
  }

  @TestMethod
  public rejectsAMissingOrUnknownAnswerAndUnknownFields(): void {
    Assert.areEqual("$.answer", Assert.throws(() => QuitAnswered.fromJson({}), JsonException).path);
    Assert.areEqual("$.answer", Assert.throws(() => QuitAnswered.fromJson({ answer: "Quitting" }), JsonException).path);
    Assert.areEqual("$.outcome", Assert.throws(() => QuitAnswered.fromJson({ answer: "Stayed", outcome: "Quit" }), JsonException).path);
  }
}
