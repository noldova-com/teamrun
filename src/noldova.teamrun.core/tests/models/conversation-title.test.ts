/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { ConversationTitle, TitleModel } from "@noldova/teamrun.core";

@TestClass
export class ConversationTitleTests {
  @TestMethod
  public takesTheFirstLineWithTextTrimmed(): void {
    Assert.areEqual("Fix the login bug", new ConversationTitle("\n \n  Fix the login bug  \nand more").text);
    Assert.areEqual(String.empty, new ConversationTitle(" \n ").text);
  }

  @TestMethod
  public cutsALongLineToSixtyCharactersEndingWithAnEllipsis(): void {
    Assert.areEqual("x".repeat(60), new ConversationTitle("x".repeat(60)).text);
    Assert.areEqual(`${"x".repeat(50)}…`, new ConversationTitle(`${"x".repeat(50)}         ${"y".repeat(20)}`).text);
    Assert.areEqual(`${"z".repeat(59)}…`, new ConversationTitle("z".repeat(80)).text);
  }

  @TestMethod
  @TestData("Fix the login page", "Fix the login page")
  @TestData("\n\n  Fix the login page\nBecause it is broken", "Fix the login page")
  @TestData("\"Fix the login page.\"", "Fix the login page")
  @TestData("“Fix the login page”", "Fix the login page")
  @TestData("**Fix the login page**", "Fix the login page")
  @TestData("# Fix the login page", "Fix the login page")
  @TestData("Title: Fix the login page", "Fix the login page")
  @TestData("**title:** Fix  the   login page", "Fix the login page")
  @TestData("Don't panic", "Don't panic")
  public readsATitleFromAModelsAnswer(answer: string, title: string): void {
    Assert.areEqual(title, ConversationTitle.ofAnswer(answer));
  }

  @TestMethod
  public cutsALongAnswerAndFindsNoTitleInAnEmptyOne(): void {
    Assert.areEqual(`${"z".repeat(59)}…`, ConversationTitle.ofAnswer("z".repeat(80)));
    Assert.isNull(ConversationTitle.ofAnswer(String.empty));
    Assert.isNull(ConversationTitle.ofAnswer(" \n "));
    Assert.isNull(ConversationTitle.ofAnswer("\"...\""));
  }

  @TestMethod
  public tellsWhetherTwoTitleModelsAreTheSame(): void {
    const model = new TitleModel(null, "fake", "small");
    Assert.isTrue(model.isSameAs(new TitleModel(null, "fake", "small")));
    Assert.isFalse(model.isSameAs(new TitleModel(null, "other", "small")));
    Assert.isFalse(model.isSameAs(new TitleModel(null, "fake", "large")));
  }
}
