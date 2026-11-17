/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ShellToken, ShellTokenKind } from "@noldova/teamrun.providers";

@TestClass
export class ShellTokenTests {
  @TestMethod
  public keepsItsKindTextQuotingWhetherItRunsCommandsAndItsItems(): void {
    const items = [ShellToken.word("a"), ShellToken.word("b")];
    const token = new ShellToken(ShellTokenKind.Redirect, ">>", false, true, true, items);

    Assert.areEqual(ShellTokenKind.Redirect, token.kind);
    Assert.areEqual(">>", token.text);
    Assert.isFalse(token.isLiteral);
    Assert.isTrue(token.isQuoted);
    Assert.isTrue(token.runsCommands);
    Assert.areEqual(items, token.items);
  }

  @TestMethod
  public makesALiteralUnquotedWordByDefault(): void {
    const token = ShellToken.word("a.txt");

    Assert.areEqual(ShellTokenKind.Word, token.kind);
    Assert.areEqual("a.txt", token.text);
    Assert.isTrue(token.isLiteral);
    Assert.isFalse(token.isQuoted);
    Assert.isFalse(token.runsCommands);
    Assert.areEqual(0, token.items.length);
  }
}
