/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { TextCut } from "@noldova/teamrun.protocol";

@TestClass
export class TextCutTests {
  @TestMethod
  @TestData("ab\u{1F600}", 3, "ab")
  @TestData("ab\u{1F600}", 4, "ab\u{1F600}")
  @TestData("a\u{1F469}\u200D\u{1F4BB}", 5, "a")
  @TestData("a\u{1F469}\u200D\u{1F4BB}", 6, "a\u{1F469}\u200D\u{1F4BB}")
  @TestData("a\u{1F1EB}\u{1F1F7}", 3, "a")
  @TestData("a1\uFE0F\u20E3", 3, "a")
  @TestData("a1\uFE0F\u20E3", 4, "a1\uFE0F\u20E3")
  @TestData("plain", 3, "pla")
  @TestData("", 3, "")
  public cutsToUtf16UnitsOnAGraphemeBoundary(text: string, limit: number, expected: string): void {
    Assert.areEqual(expected, TextCut.toUnits(text, limit));
  }

  @TestMethod
  @TestData("a\u{1F469}\u200D\u{1F4BB}", 3, "a")
  @TestData("a\u{1F469}\u200D\u{1F4BB}", 4, "a\u{1F469}\u200D\u{1F4BB}")
  @TestData("a\u{1F1EB}\u{1F1F7}", 2, "a")
  @TestData("a\u{1F1EB}\u{1F1F7}", 3, "a\u{1F1EB}\u{1F1F7}")
  @TestData("a\u{1F44D}\u{1F3FD}", 2, "a")
  @TestData("a1\uFE0F\u20E3", 3, "a")
  @TestData("ae\u0301", 2, "a")
  @TestData("ab\u{1F600}", 3, "ab\u{1F600}")
  public cutsToCodePointsOnAGraphemeBoundary(text: string, limit: number, expected: string): void {
    Assert.areEqual(expected, TextCut.toPoints(text, limit));
  }
}
