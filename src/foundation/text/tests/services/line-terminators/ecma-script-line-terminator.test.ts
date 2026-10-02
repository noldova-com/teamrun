/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { EcmaScriptLineTerminator, LineTerminator } from "@noldova/teamrun-foundation-text";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class EcmaScriptLineTerminatorTests {
  private readonly lineTerminator: EcmaScriptLineTerminator = new EcmaScriptLineTerminator();

  @TestMethod
  public recognizesEveryLineTerminator(): void {
    Assert.areEqual(1, this.lineTerminator.getLength("\n", 0));
    Assert.areEqual(1, this.lineTerminator.getLength("\r", 0));
    Assert.areEqual(2, this.lineTerminator.getLength("\r\n", 0));
    Assert.areEqual(1, this.lineTerminator.getLength("\u2028", 0));
    Assert.areEqual(1, this.lineTerminator.getLength("\u2029", 0));
  }

  @TestMethod
  public returnsZeroForOrdinaryTextAndEndOfString(): void {
    Assert.areEqual(0, this.lineTerminator.getLength("text", 0));
    Assert.areEqual(0, this.lineTerminator.getLength("text", 4));
    Assert.areEqual(0, this.lineTerminator.getLength("\u0085", 0));
  }

  @TestMethod
  public rejectsAnInvalidIndex(): void {
    Assert.throws(() => this.lineTerminator.getLength("text", -1), ArgumentOutOfRangeException);
    Assert.throws(() => this.lineTerminator.getLength("text", 5), ArgumentOutOfRangeException);
    Assert.throws(() => this.lineTerminator.getLength("text", 0.5), ArgumentOutOfRangeException);
  }

  @TestMethod
  public classifiesSingleLineTerminatorCodeUnits(): void {
    Assert.isTrue(this.lineTerminator.isLineTerminator("\r"));
    Assert.isTrue(this.lineTerminator.isLineTerminator("\n"));
    Assert.isTrue(this.lineTerminator.isLineTerminator("\u2028"));
    Assert.isTrue(this.lineTerminator.isLineTerminator("\u2029"));
    Assert.isFalse(this.lineTerminator.isLineTerminator(String.empty));
    Assert.isFalse(this.lineTerminator.isLineTerminator("\r\n"));
    Assert.isFalse(this.lineTerminator.isLineTerminator("\u0085"));
    Assert.isFalse(this.lineTerminator.isLineTerminator("text"));
  }

  @TestMethod
  public isALineTerminator(): void {
    Assert.isInstanceOf(this.lineTerminator, LineTerminator);
  }
}
