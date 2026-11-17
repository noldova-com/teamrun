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
import { QuestionAnswer } from "@noldova/teamrun.protocol";

@TestClass
export class QuestionAnswerTests {
  @TestMethod
  public holdsTheChoicesAndTheOwnText(): void {
    const choices = ["Attachments", "Slash commands"];
    const answer = new QuestionAnswer("parts", choices, "And a voice button");
    choices.pop();

    Assert.areEqual("parts", answer.questionId);
    Assert.areEqual(JSON.stringify(["Attachments", "Slash commands"]), JSON.stringify(answer.choices));
    Assert.areEqual("And a voice button", answer.text);
  }

  @TestMethod
  public keepsBlankTextAsNoText(): void {
    Assert.isNull(new QuestionAnswer("platform", ["Desktop app"], " ").text);
    Assert.areEqual("Mobile", new QuestionAnswer("platform", [], "Mobile").text);
  }

  @TestMethod
  public rejectsAnAnswerWithNothingOrWithBadChoices(): void {
    Assert.throws(() => new QuestionAnswer(" ", ["Yes"], null), ArgumentException);
    Assert.throws(() => new QuestionAnswer("q", [], null), ArgumentException);
    Assert.throws(() => new QuestionAnswer("q", [], " "), ArgumentException);
    Assert.throws(() => new QuestionAnswer("q", ["Yes", "Yes"], null), ArgumentException);
    Assert.throws(() => new QuestionAnswer("q", [String.empty], null), ArgumentException);
  }

  @TestMethod
  public roundTripsThroughJsonAndReportsBadChoicesWithTheirPath(): void {
    const json = { questionId: "parts", choices: ["Attachments"], text: null };
    const notStrings = Assert.throws(() => QuestionAnswer.fromJson({ questionId: "parts", choices: [1], text: null }, "$.answers.0"), JsonException);

    Assert.areEqual(JSON.stringify(json), JSON.stringify(QuestionAnswer.fromJson(json).toJson()));
    Assert.areEqual("$.answers.0.choices.0", notStrings.path);
  }
}
