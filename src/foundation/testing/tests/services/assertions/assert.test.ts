/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, AssertFailedException, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class AssertTests {
  @TestMethod
  public isTruePassesForTrue(): void {
    Assert.isTrue(true);
  }

  @TestMethod
  public isTrueFailsForFalse(): void {
    const failure = Assert.throws(() => {
      Assert.isTrue(false);
    }, AssertFailedException);

    Assert.areEqual("Expected the condition to be true.", failure.message);
    Assert.areEqual<unknown>(true, failure.expected);
    Assert.areEqual<unknown>(false, failure.actual);
  }

  @TestMethod
  public isFalsePassesForFalse(): void {
    Assert.isFalse(false);
  }

  @TestMethod
  public isFalseFailsForTrue(): void {
    const failure = Assert.throws(() => {
      Assert.isFalse(true);
    }, AssertFailedException);

    Assert.areEqual("Expected the condition to be false.", failure.message);
  }

  @TestMethod
  public areEqualPassesForEqualValues(): void {
    Assert.areEqual(42, 42);
    Assert.areEqual("text", "text");
  }

  @TestMethod
  public areEqualUsesSameValueForNotANumber(): void {
    Assert.areEqual(Number.NaN, Number.NaN);
  }

  @TestMethod
  public areEqualUsesSameValueForSignedZero(): void {
    Assert.throws(() => {
      Assert.areEqual(0, -0);
    }, AssertFailedException);
  }

  @TestMethod
  public areEqualFailsForDifferentValues(): void {
    const failure = Assert.throws(() => {
      Assert.areEqual(1, 2);
    }, AssertFailedException);

    Assert.areEqual("Expected the values to be equal.", failure.message);
    Assert.areEqual<unknown>(1, failure.expected);
    Assert.areEqual<unknown>(2, failure.actual);
  }

  @TestMethod
  public areNotEqualPassesForDifferentValues(): void {
    Assert.areNotEqual(1, 2);
  }

  @TestMethod
  public areNotEqualFailsForEqualValues(): void {
    const failure = Assert.throws(() => {
      Assert.areNotEqual(7, 7);
    }, AssertFailedException);

    Assert.areEqual("Expected the values to be different.", failure.message);
  }

  @TestMethod
  public isNullPassesForNull(): void {
    Assert.isNull(null);
  }

  @TestMethod
  public isNullFailsForUndefined(): void {
    Assert.throws(() => {
      Assert.isNull(undefined);
    }, AssertFailedException);
  }

  @TestMethod
  public isNotNullPassesAndNarrows(): void {
    const value: string | null = "text";

    Assert.isNotNull(value);

    Assert.areEqual(4, value.length);
  }

  @TestMethod
  public isNotNullFailsForNull(): void {
    Assert.throws(() => {
      Assert.isNotNull(null);
    }, AssertFailedException);
  }

  @TestMethod
  public isNotNullAllowsUndefined(): void {
    Assert.doesNotThrow(() => {
      Assert.isNotNull(undefined);
    });
  }

  @TestMethod
  public isUndefinedPassesForUndefined(): void {
    Assert.isUndefined(undefined);
  }

  @TestMethod
  public isUndefinedFailsForNull(): void {
    Assert.throws(() => {
      Assert.isUndefined(null);
    }, AssertFailedException);
  }

  @TestMethod
  public isDefinedPassesForAValue(): void {
    Assert.isDefined("text");
  }

  @TestMethod
  public isDefinedPassesForNull(): void {
    Assert.isDefined(null);
  }

  @TestMethod
  public isDefinedFailsForUndefined(): void {
    Assert.throws(() => {
      Assert.isDefined(undefined);
    }, AssertFailedException);
  }

  @TestMethod
  public isInstanceOfPassesForAnInstance(): void {
    Assert.isInstanceOf(new ArgumentException(), ArgumentException);
  }

  @TestMethod
  public isInstanceOfFailsForAnotherType(): void {
    const failure = Assert.throws(() => {
      Assert.isInstanceOf("text", ArgumentException);
    }, AssertFailedException);

    Assert.areEqual("Expected the value to be an instance of the specified type.", failure.message);
    Assert.areEqual<unknown>("ArgumentException", failure.expected);
  }

  @TestMethod
  public throwsReturnsTheCaughtException(): void {
    const caught = Assert.throws(() => {
      throw new ArgumentException("Bad value.", "input");
    }, ArgumentException);

    Assert.areEqual("input", caught.parameterName);
  }

  @TestMethod
  public throwsFailsWhenNothingIsThrown(): void {
    const failure = Assert.throws(() => {
      Assert.throws(() => { }, ArgumentException);
    }, AssertFailedException);

    Assert.areEqual("Expected the action to throw.", failure.message);
  }

  @TestMethod
  public throwsFailsForAnotherExceptionType(): void {
    const failure = Assert.throws(() => {
      Assert.throws(() => {
        throw new Error("plain");
      }, ArgumentException);
    }, AssertFailedException);

    Assert.areEqual("Expected the action to throw the specified exception type.", failure.message);
  }

  @TestMethod
  public async throwsAsyncReturnsTheCaughtException(): Promise<void> {
    const caught = await Assert.throwsAsync(async () => {
      throw new ArgumentException("Bad value.", "input");
    }, ArgumentException);

    Assert.areEqual("input", caught.parameterName);
  }

  @TestMethod
  public async throwsAsyncFailsWhenNothingRejects(): Promise<void> {
    const failure = await Assert.throwsAsync(async () => {
      await Assert.throwsAsync(async () => { }, ArgumentException);
    }, AssertFailedException);

    Assert.areEqual("Expected the action to throw.", failure.message);
  }

  @TestMethod
  public async throwsAsyncFailsForAnotherExceptionType(): Promise<void> {
    const failure = await Assert.throwsAsync(async () => {
      await Assert.throwsAsync(async () => {
        throw new Error("plain");
      }, ArgumentException);
    }, AssertFailedException);

    Assert.areEqual("Expected the action to throw the specified exception type.", failure.message);
  }

  @TestMethod
  public doesNotThrowPassesForACalmAction(): void {
    Assert.doesNotThrow(() => { });
  }

  @TestMethod
  public doesNotThrowFailsForAThrowingAction(): void {
    const failure = Assert.throws(() => {
      Assert.doesNotThrow(() => {
        throw new Error("boom");
      });
    }, AssertFailedException);

    Assert.areEqual("Expected the action not to throw.", failure.message);
  }

  @TestMethod
  public failThrowsUnconditionally(): void {
    const failure = Assert.throws(() => {
      Assert.fail();
    }, AssertFailedException);

    Assert.areEqual("Assertion failed.", failure.message);
  }

  @TestMethod
  public customMessagesOverrideTheDefaults(): void {
    Assert.areEqual("custom", Assert.throws(() => { Assert.isTrue(false, "custom"); }, AssertFailedException).message);
    Assert.areEqual("custom", Assert.throws(() => { Assert.isFalse(true, "custom"); }, AssertFailedException).message);
    Assert.areEqual("custom", Assert.throws(() => { Assert.areEqual(1, 2, "custom"); }, AssertFailedException).message);
    Assert.areEqual("custom", Assert.throws(() => { Assert.areNotEqual(1, 1, "custom"); }, AssertFailedException).message);
    Assert.areEqual("custom", Assert.throws(() => { Assert.isNull(1, "custom"); }, AssertFailedException).message);
    Assert.areEqual("custom", Assert.throws(() => { Assert.isNotNull(null, "custom"); }, AssertFailedException).message);
    Assert.areEqual("custom", Assert.throws(() => { Assert.isUndefined(null, "custom"); }, AssertFailedException).message);
    Assert.areEqual("custom", Assert.throws(() => { Assert.isDefined(undefined, "custom"); }, AssertFailedException).message);
    Assert.areEqual("custom", Assert.throws(() => { Assert.isInstanceOf(1, ArgumentException, "custom"); }, AssertFailedException).message);
    Assert.areEqual("custom", Assert.throws(() => { Assert.throws(() => { }, ArgumentException, "custom"); }, AssertFailedException).message);
    const failure = Assert.throws(() => {
      Assert.throws(() => {
        throw new Error("plain");
      }, ArgumentException, "custom");
    }, AssertFailedException);

    Assert.areEqual("custom", failure.message);
    Assert.areEqual("custom", Assert.throws(() => { Assert.doesNotThrow(() => { throw new Error("boom"); }, "custom"); }, AssertFailedException).message);
    Assert.areEqual("custom", Assert.throws(() => { Assert.fail("custom"); }, AssertFailedException).message);
  }

  @TestMethod
  public async customMessagesOverrideTheAsynchronousDefaults(): Promise<void> {
    const noRejection = await Assert.throwsAsync(async () => {
      await Assert.throwsAsync(async () => { }, ArgumentException, "custom");
    }, AssertFailedException);
    Assert.areEqual("custom", noRejection.message);

    const wrongType = await Assert.throwsAsync(async () => {
      await Assert.throwsAsync(async () => { throw new Error("plain"); }, ArgumentException, "custom");
    }, AssertFailedException);
    Assert.areEqual("custom", wrongType.message);
  }
}
