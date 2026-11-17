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
import { ApprovalDecideParams, QuestionAnswer } from "@noldova/teamrun.protocol";

@TestClass
export class ApprovalDecideParamsTests {
  private static readonly json: object = { approvalId: "apr-1", optionId: "acceptForSession" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ApprovalDecideParams.fromJson(ApprovalDecideParamsTests.json);

    Assert.areEqual(JSON.stringify(ApprovalDecideParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public carriesTheAnswersOnlyWhenThereAreAny(): void {
    const json = { approvalId: "apr-1", optionId: "answer", answers: [{ questionId: "platform", choices: ["Desktop app"], text: null }] };
    const value = ApprovalDecideParams.fromJson(json);
    const answers = [new QuestionAnswer("parts", ["Attachments"], "Voice")];
    const made = new ApprovalDecideParams("apr-1", "answer", answers);
    answers.pop();

    Assert.areEqual(JSON.stringify(json), JSON.stringify(value.toJson()));
    Assert.areEqual("Voice", made.answers?.[0]?.text);
    Assert.isNull(ApprovalDecideParams.fromJson(ApprovalDecideParamsTests.json).answers);
    Assert.isFalse(Object.hasOwn(new ApprovalDecideParams("apr-1", "skip").toJson(), "answers"));
    Assert.areEqual("$.answers.0.questionId", Assert.throws(() => ApprovalDecideParams.fromJson({ ...json, answers: [{ choices: [], text: "x" }] }),
      JsonException).path);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const valid = ApprovalDecideParams.fromJson(ApprovalDecideParamsTests.json);

    Assert.throws(() => new ApprovalDecideParams(String.empty, valid.optionId), ArgumentException);
    Assert.throws(() => new ApprovalDecideParams(valid.approvalId, String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ApprovalDecideParams.fromJson({ ...ApprovalDecideParamsTests.json, optionId: String.empty }), JsonException);

    Assert.areEqual("$.optionId", exception.path);
  }
}
