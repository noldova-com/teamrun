/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { QuestionAsk } from "@noldova/teamrun.core";
import { ApprovalQuestion, QuestionOption } from "@noldova/teamrun.protocol";

@TestClass
export class QuestionAskTests {
  private static readonly question: ApprovalQuestion =
    new ApprovalQuestion("platform", "Platform", "Which platform?", [new QuestionOption("Desktop app", "The window")], false, true, false);

  @TestMethod
  public holdsTheProvidersQuestionsAsACopy(): void {
    const questions = [QuestionAskTests.question];
    const ask = new QuestionAsk("req-1", "AskUserQuestion", questions);
    questions.length = 0;

    Assert.areEqual("req-1", ask.providerRequestId);
    Assert.areEqual("AskUserQuestion", ask.nativeKind);
    Assert.areEqual("platform", ask.questions.map(t => t.id).join(","));
    Assert.isNull(ask.subAgent);
    Assert.areEqual("Explore the parser", new QuestionAsk("req-2", "AskUserQuestion", [QuestionAskTests.question], "Explore the parser").subAgent);
  }

  @TestMethod
  public rejectsBlankTextsAndNoQuestions(): void {
    const questions = [QuestionAskTests.question];

    Assert.areEqual("providerRequestId", Assert.throws(() => new QuestionAsk(" ", "AskUserQuestion", questions), ArgumentException).parameterName);
    Assert.areEqual("nativeKind", Assert.throws(() => new QuestionAsk("r", "", questions), ArgumentException).parameterName);
    Assert.areEqual("questions", Assert.throws(() => new QuestionAsk("r", "AskUserQuestion", []), ArgumentException).parameterName);
  }
}
