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
import { ApprovalQuestion, QuestionOption } from "@noldova/teamrun.protocol";

@TestClass
export class ApprovalQuestionTests {
  @TestMethod
  public holdsAQuestionWithItsOptions(): void {
    const options = [new QuestionOption("Desktop app", "A window with a side panel"), new QuestionOption("Web page", "Runs in the browser")];
    const question = new ApprovalQuestion("q-1", "Platform", "Where will the composer run?", options, false, true, false);
    options.pop();

    Assert.areEqual("q-1", question.id);
    Assert.areEqual("Platform", question.header);
    Assert.areEqual("Where will the composer run?", question.text);
    Assert.areEqual(JSON.stringify(["Desktop app", "Web page"]), JSON.stringify(question.options.map(t => t.label)));
    Assert.isFalse(question.multiple);
    Assert.isTrue(question.other);
    Assert.isFalse(question.secret);
  }

  @TestMethod
  public takesOnlyTheOwnTextWhenItOffersNoOption(): void {
    const question = new ApprovalQuestion("token", String.empty, "Which access token should I use?", [], false, true, true);

    Assert.areEqual(0, question.options.length);
    Assert.isTrue(question.secret);
    Assert.throws(() => new ApprovalQuestion("token", String.empty, "Which token?", [], false, false, false), ArgumentException);
  }

  @TestMethod
  public rejectsBlankTextAndRepeatedLabels(): void {
    const option = new QuestionOption("Yes", String.empty);

    Assert.throws(() => new ApprovalQuestion(" ", "H", "Ready?", [option], false, false, false), ArgumentException);
    Assert.throws(() => new ApprovalQuestion("q", "H", String.empty, [option], false, false, false), ArgumentException);
    Assert.throws(() => new ApprovalQuestion("q", "H", "Ready?", [option, new QuestionOption("Yes", "Again")], false, false, false), ArgumentException);
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const json = {
      id: "parts", header: "Parts", text: "Which parts should the mockup include?",
      options: [{ label: "Attachments", description: String.empty }, { label: "Model picker", description: "The model menu" }],
      multiple: true, other: true, secret: false
    };

    Assert.areEqual(JSON.stringify(json), JSON.stringify(ApprovalQuestion.fromJson(json).toJson()));
  }

  @TestMethod
  public reportsAnInvalidOptionWithItsPath(): void {
    const json = { id: "q", header: "H", text: "Ready?", options: [{ label: " ", description: String.empty }], multiple: false, other: false, secret: false };
    const missing = Assert.throws(() => ApprovalQuestion.fromJson({ ...json, options: [], other: undefined }, "$.questions.0"), JsonException);
    const blank = Assert.throws(() => ApprovalQuestion.fromJson(json, "$.questions.0"), JsonException);

    Assert.areEqual("$.questions.0.other", missing.path);
    Assert.areEqual("$.questions.0.options.0.label", blank.path);
  }
}
