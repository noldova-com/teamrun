/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { LogText } from "@noldova/teamrun-shell-runtime";

@TestClass
export class LogTextTests {
  @TestMethod
  public endsALineAtEveryLineEnding(): void {
    const lines = LogText.lines("a\r\nb\nc\rd\ve\ff\u0085g\u2028h\u2029i");

    Assert.areEqual(JSON.stringify(["a", "b", "c", "d", "e", "f", "g", "h", "i"]), JSON.stringify(lines));
  }

  @TestMethod
  public keepsTabsAndRemovesEveryOtherControlCharacter(): void {
    const lines = LogText.lines("\u001b[31mred\u001b[0m\tand\u0000 \u007fplain\u009b");

    Assert.areEqual(JSON.stringify(["[31mred[0m\tand plain"]), JSON.stringify(lines));
  }

  @TestMethod
  public leavesOutTrailingWhiteSpaceButKeepsEmptyLinesWithin(): void {
    const lines = LogText.lines("first\n\n  second  \r\n\n");

    Assert.areEqual(JSON.stringify(["first", "", "  second"]), JSON.stringify(lines));
  }
}
