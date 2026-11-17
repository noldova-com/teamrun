/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { MentionToken } from "@noldova/teamrun.protocol";

@TestClass
export class MentionTokenTests {
  @TestMethod
  public writesATokenThatReadsBackWithItsIdAndLabel(): void {
    const text = MentionToken.format("0192-ab", "Chat GPT");
    Assert.areEqual("[@Chat GPT](mention:0192-ab)", text);

    const token = MentionToken.at(`hi ${text}!`, 3);
    Assert.areEqual("0192-ab", token?.teammateId);
    Assert.areEqual("Chat GPT", token?.label);
    Assert.areEqual(3, token?.start);
    Assert.areEqual(3 + text.length, token?.end);
  }

  @TestMethod
  public findsNoTokenWhereNoneStarts(): void {
    for (const [text, start] of [["[@Chat](mention:a)", 1], ["[Chat](mention:a)", 0], ["[@Chat](link:a)", 0], ["[@](mention:a)", 0], ["[@Chat](mention:)", 0]] as const)
      Assert.isNull(MentionToken.at(text, start), text);
  }

  @TestMethod
  public refusesALabelOrIdThatCantBeWrittenInAToken(): void {
    for (const [id, label] of [["a", "Chat]"], ["a", "Chat\nGPT"], ["a b", "Chat"], ["a)", "Chat"], ["(a", "Chat"], ["a", ""], ["", "Chat"]] as const)
      Assert.throws(() => MentionToken.format(id, label), ArgumentException, `${id} ${label}`);
  }
}
