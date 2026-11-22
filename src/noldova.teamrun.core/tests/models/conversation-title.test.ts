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
  public cutsByCodePointSoAnEmojiIsNeverSplit(): void {
    const emoji = String.fromCodePoint(0x1F600);
    Assert.areEqual(emoji.repeat(60), new ConversationTitle(emoji.repeat(60)).text);
    Assert.areEqual(`${emoji.repeat(59)}…`, new ConversationTitle(emoji.repeat(80)).text);
    Assert.areEqual(`${"x".repeat(58)}${emoji}…`, new ConversationTitle(`${"x".repeat(58)}${emoji.repeat(5)}`).text);
  }

  @TestMethod
  @TestData("\u{1F469}\u200D\u{1F4BB}")
  @TestData("\u{1F1EB}\u{1F1F7}")
  @TestData("\u{1F44D}\u{1F3FD}")
  @TestData("1\uFE0F\u20E3")
  @TestData("e\u0301")
  public endsACutTitleBeforeACharacterTheCutWouldSplit(character: string): void {
    Assert.areEqual(`${"x".repeat(58)}…`, new ConversationTitle(`${"x".repeat(58)}${character}${"y".repeat(10)}`).text);
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
