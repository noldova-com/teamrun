/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UnicodeCodePoint } from "@noldova/teamrun-foundation-text";

@TestClass
export class UnicodeCodePointTests {
  @TestMethod
  public recognizesIdentifierStartCodePoints(): void {
    Assert.isTrue(UnicodeCodePoint.isIdentifierStart(0x41));
    Assert.isTrue(UnicodeCodePoint.isIdentifierStart(0x03C0));
    Assert.isTrue(UnicodeCodePoint.isIdentifierStart(0x20000));
    Assert.isTrue(UnicodeCodePoint.isIdentifierStart(0x2EBF0));
  }

  @TestMethod
  public rejectsNonStartCodePoints(): void {
    Assert.isFalse(UnicodeCodePoint.isIdentifierStart(0x24));
    Assert.isFalse(UnicodeCodePoint.isIdentifierStart(0x30));
    Assert.isFalse(UnicodeCodePoint.isIdentifierStart(0x5F));
    Assert.isFalse(UnicodeCodePoint.isIdentifierStart(0x300));
    Assert.isFalse(UnicodeCodePoint.isIdentifierStart(0x200C));
    Assert.isFalse(UnicodeCodePoint.isIdentifierStart(0x1F600));
  }

  @TestMethod
  public honorsDiscontinuousUnicodeRanges(): void {
    Assert.isTrue(UnicodeCodePoint.isIdentifierStart(0xAA));
    Assert.isFalse(UnicodeCodePoint.isIdentifierStart(0xAB));
    Assert.isTrue(UnicodeCodePoint.isIdentifierStart(0xB5));
  }

  @TestMethod
  public recognizesIdentifierContinueCodePoints(): void {
    Assert.isTrue(UnicodeCodePoint.isIdentifierContinue(0x41));
    Assert.isTrue(UnicodeCodePoint.isIdentifierContinue(0x30));
    Assert.isTrue(UnicodeCodePoint.isIdentifierContinue(0x5F));
    Assert.isTrue(UnicodeCodePoint.isIdentifierContinue(0x300));
    Assert.isTrue(UnicodeCodePoint.isIdentifierContinue(0x200C));
    Assert.isTrue(UnicodeCodePoint.isIdentifierContinue(0x200D));
    Assert.isTrue(UnicodeCodePoint.isIdentifierContinue(0x2EBF0));
  }

  @TestMethod
  public rejectsNonContinueCodePoints(): void {
    Assert.isFalse(UnicodeCodePoint.isIdentifierContinue(0x24));
    Assert.isFalse(UnicodeCodePoint.isIdentifierContinue(0x2D));
    Assert.isFalse(UnicodeCodePoint.isIdentifierContinue(0x1F600));
  }

  @TestMethod
  public rejectsInvalidNumericValues(): void {
    Assert.isFalse(UnicodeCodePoint.isIdentifierStart(Number.NaN));
    Assert.isFalse(UnicodeCodePoint.isIdentifierStart(-1));
    Assert.isFalse(UnicodeCodePoint.isIdentifierContinue(0x110000));
    Assert.isFalse(UnicodeCodePoint.isIdentifierContinue(0x41 + 0.5));
  }

  @TestMethod
  public recognizesLeadingSurrogateCodePoints(): void {
    Assert.isTrue(UnicodeCodePoint.isLeadingSurrogate(0xD800));
    Assert.isTrue(UnicodeCodePoint.isLeadingSurrogate(0xDBFF));
  }

  @TestMethod
  public rejectsNonLeadingSurrogateCodePoints(): void {
    Assert.isFalse(UnicodeCodePoint.isLeadingSurrogate(Number.NaN));
    Assert.isFalse(UnicodeCodePoint.isLeadingSurrogate(0xD7FF));
    Assert.isFalse(UnicodeCodePoint.isLeadingSurrogate(0xDC00));
    Assert.isFalse(UnicodeCodePoint.isLeadingSurrogate(0xD800 + 0.5));
  }

  @TestMethod
  public recognizesTrailingSurrogateCodePoints(): void {
    Assert.isTrue(UnicodeCodePoint.isTrailingSurrogate(0xDC00));
    Assert.isTrue(UnicodeCodePoint.isTrailingSurrogate(0xDFFF));
  }

  @TestMethod
  public rejectsNonTrailingSurrogateCodePoints(): void {
    Assert.isFalse(UnicodeCodePoint.isTrailingSurrogate(Number.NaN));
    Assert.isFalse(UnicodeCodePoint.isTrailingSurrogate(0xDBFF));
    Assert.isFalse(UnicodeCodePoint.isTrailingSurrogate(0xE000));
    Assert.isFalse(UnicodeCodePoint.isTrailingSurrogate(0xDC00 + 0.5));
  }
}
