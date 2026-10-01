/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class ArgumentOutOfRangeExceptionTests {
  @TestMethod
  public defaultsTheMessageAndCarriesTheParameter(): void {
    const failure = new ArgumentOutOfRangeException("index", 5);

    Assert.areEqual("The argument must be within the valid range. (Parameter 'index')", failure.message);
    Assert.areEqual("index", failure.parameterName);
    Assert.areEqual(5, failure.actualValue);
  }

  @TestMethod
  public acceptsACustomMessageAndCause(): void {
    const cause = new Error("cause");
    const failure = new ArgumentOutOfRangeException("index", 5, "Invalid index.", new ExceptionOptions(cause));

    Assert.areEqual("Invalid index. (Parameter 'index')", failure.message);
    Assert.areEqual(cause, failure.cause);
  }

  @TestMethod
  public setsTheName(): void {
    Assert.areEqual("ArgumentOutOfRangeException", new ArgumentOutOfRangeException().name);
  }

  @TestMethod
  public isAnArgumentException(): void {
    Assert.isInstanceOf(new ArgumentOutOfRangeException(), ArgumentException);
  }

  @TestMethod
  public throwsForValuesThatAreNotPositiveIntegers(): void {
    Assert.throws(() => ArgumentOutOfRangeException.throwIfNotPositiveInteger(0, "count"), ArgumentOutOfRangeException);
    Assert.throws(() => ArgumentOutOfRangeException.throwIfNotPositiveInteger(-1, "count"), ArgumentOutOfRangeException);
    Assert.throws(() => ArgumentOutOfRangeException.throwIfNotPositiveInteger(0.5, "count"), ArgumentOutOfRangeException);
  }

  @TestMethod
  public acceptsPositiveIntegers(): void {
    Assert.doesNotThrow(() => ArgumentOutOfRangeException.throwIfNotPositiveInteger(1, "count"));
  }
}
