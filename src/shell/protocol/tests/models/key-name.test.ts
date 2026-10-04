/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { type IKeyStroke, KeyName } from "@noldova/teamrun-shell-protocol";

@TestClass
export class KeyNameTests {
  @TestMethod
  public knowsLettersDigitsPunctuationNamedAndFunctionKeys(): void {
    for (const token of ["A", "Z", "0", "9", "Backquote", "Slash", "Enter", "Space", "ArrowLeft", "F1", "F24"])
      Assert.areEqual(token, KeyName.find(token)?.token, token);
    for (const token of ["a", "F0", "F25", "Plus", "Meta", ""])
      Assert.isUndefined(KeyName.find(token), token);
    Assert.areEqual(true, KeyName.find("F7")?.isFunctionKey);
    Assert.areEqual(false, KeyName.find("K")?.isFunctionKey);
  }

  @TestMethod
  public matchesALetterByItsValueAndANonLatinLayoutByItsPlace(): void {
    const k = KeyName.find("K");

    Assert.areEqual(true, k?.matches(KeyNameTests.stroke("k", "KeyK")));
    Assert.areEqual(true, k?.matches(KeyNameTests.stroke("K", "KeyK")));
    Assert.areEqual(true, k?.matches(KeyNameTests.stroke("\u043B", "KeyK")));
    Assert.areEqual(false, k?.matches(KeyNameTests.stroke("q", "KeyK")));
    Assert.areEqual(false, k?.matches(KeyNameTests.stroke("j", "KeyJ")));
  }

  @TestMethod
  public matchesDigitsPunctuationAndSpaceByTheirPlace(): void {
    Assert.areEqual(true, KeyName.find("1")?.matches(KeyNameTests.stroke("!", "Digit1")));
    Assert.areEqual(true, KeyName.find("Backquote")?.matches(KeyNameTests.stroke("~", "Backquote")));
    Assert.areEqual(false, KeyName.find("Backquote")?.matches(KeyNameTests.stroke("`", "IntlBackslash")));
    Assert.areEqual(true, KeyName.find("Space")?.matches(KeyNameTests.stroke(" ", "Space")));
  }

  @TestMethod
  public matchesNamedAndFunctionKeysByTheirValue(): void {
    Assert.areEqual(true, KeyName.find("Enter")?.matches(KeyNameTests.stroke("Enter", "NumpadEnter")));
    Assert.areEqual(true, KeyName.find("F2")?.matches(KeyNameTests.stroke("F2", "F2")));
    Assert.areEqual(false, KeyName.find("Escape")?.matches(KeyNameTests.stroke("Enter", "Enter")));
  }

  @TestMethod
  public findsTheKeyAStrokeReports(): void {
    Assert.areEqual("K", KeyName.fromStroke(KeyNameTests.stroke("K", "KeyK"))?.token);
    Assert.areEqual("A", KeyName.fromStroke(KeyNameTests.stroke("a", "KeyQ"))?.token);
    Assert.areEqual("K", KeyName.fromStroke(KeyNameTests.stroke("\u043B", "KeyK"))?.token);
    Assert.areEqual("1", KeyName.fromStroke(KeyNameTests.stroke("&", "Digit1"))?.token);
    Assert.areEqual("Comma", KeyName.fromStroke(KeyNameTests.stroke("<", "Comma"))?.token);
    Assert.areEqual("Enter", KeyName.fromStroke(KeyNameTests.stroke("Enter", "NumpadEnter"))?.token);
    Assert.areEqual("F12", KeyName.fromStroke(KeyNameTests.stroke("F12", "F12"))?.token);
    Assert.areEqual("Quote", KeyName.fromStroke(KeyNameTests.stroke("Dead", "Quote"))?.token);
    for (const [key, code] of [["Control", "ControlLeft"], ["Shift", "ShiftRight"], ["Meta", "MetaLeft"], ["Unidentified", "IntlBackslash"]])
      Assert.isUndefined(KeyName.fromStroke(KeyNameTests.stroke(String(key), String(code))), key);
  }

  @TestMethod
  public labelsByThePlatformsConvention(): void {
    Assert.areEqual("\u21A9", KeyName.find("Enter")?.label(true));
    Assert.areEqual("Enter", KeyName.find("Enter")?.label(false));
    Assert.areEqual("Esc", KeyName.find("Escape")?.label(false));
    Assert.areEqual(",", KeyName.find("Comma")?.label(true));
    Assert.areEqual("K", KeyName.find("K")?.label(false));
  }

  private static stroke(key: string, code: string): IKeyStroke {
    return { key, code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false };
  }
}
