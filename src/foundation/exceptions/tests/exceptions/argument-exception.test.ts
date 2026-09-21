/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException, Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class ArgumentExceptionTests {
  @TestMethod
  public defaultsTheMessage(): void {
    Assert.areEqual("Value does not fall within the expected range.", new ArgumentException().message);
  }

  @TestMethod
  public composesTheParameterNameIntoTheMessage(): void {
    Assert.areEqual("Bad value. (Parameter 'input')", new ArgumentException("Bad value.", "input").message);
  }

  @TestMethod
  public storesTheParameterName(): void {
    Assert.areEqual("input", new ArgumentException("Bad value.", "input").parameterName);
  }

  @TestMethod
  public hasNoParameterNameWhenNoneIsGiven(): void {
    Assert.isUndefined(new ArgumentException("Bad value.").parameterName);
  }

  @TestMethod
  public preservesTheCause(): void {
    const cause = new Error("cause");

    Assert.areEqual<unknown>(cause, new ArgumentException("Bad value.", "input", new ExceptionOptions(cause)).cause);
  }

  @TestMethod
  public setsTheName(): void {
    Assert.areEqual("ArgumentException", new ArgumentException().name);
  }

  @TestMethod
  public isAnException(): void {
    Assert.isInstanceOf(new ArgumentException(), Exception);
  }

  @TestMethod
  public throwIfNullOrEmptyThrowsForNull(): void {
    const exception = Assert.throws(() => {
      ArgumentException.throwIfNullOrEmpty(null, "input");
    }, ArgumentException);

    Assert.areEqual("Value cannot be null or undefined. (Parameter 'input')", exception.message);
    Assert.areEqual("input", exception.parameterName);
  }

  @TestMethod
  public throwIfNullOrEmptyThrowsForUndefined(): void {
    Assert.throws(() => {
      ArgumentException.throwIfNullOrEmpty(undefined, "input");
    }, ArgumentException);
  }

  @TestMethod
  public throwIfNullOrEmptyThrowsForTheEmptyString(): void {
    const exception = Assert.throws(() => {
      ArgumentException.throwIfNullOrEmpty(String.empty, "input");
    }, ArgumentException);

    Assert.areEqual("The value cannot be an empty string. (Parameter 'input')", exception.message);
  }

  @TestMethod
  public throwIfNullOrEmptyPassesForWhitespace(): void {
    Assert.doesNotThrow(() => {
      ArgumentException.throwIfNullOrEmpty(" ", "input");
    });
  }

  @TestMethod
  public throwIfNullOrEmptyPassesAndNarrows(): void {
    const value: string | null | undefined = "value";

    ArgumentException.throwIfNullOrEmpty(value, "value");

    Assert.areEqual(5, value.length);
  }

  @TestMethod
  public throwIfNullOrWhitespaceThrowsForWhitespace(): void {
    const exception = Assert.throws(() => {
      ArgumentException.throwIfNullOrWhitespace(" \t ", "input");
    }, ArgumentException);

    Assert.areEqual("The value cannot be an empty string or composed entirely of whitespace. (Parameter 'input')", exception.message);
  }

  @TestMethod
  public throwIfNullOrWhitespaceThrowsForNull(): void {
    Assert.throws(() => {
      ArgumentException.throwIfNullOrWhitespace(null, "input");
    }, ArgumentException);
  }

  @TestMethod
  public throwIfNullOrWhitespacePassesForText(): void {
    Assert.doesNotThrow(() => {
      ArgumentException.throwIfNullOrWhitespace(" value ", "input");
    });
  }

  @TestMethod
  public throwIfEmptyThrowsForAnEmptyCollection(): void {
    const exception = Assert.throws(() => {
      ArgumentException.throwIfEmpty([], "values");
    }, ArgumentException);

    Assert.areEqual("The collection must contain at least one element. (Parameter 'values')", exception.message);
    Assert.areEqual("values", exception.parameterName);
  }

  @TestMethod
  public throwIfEmptyPassesAndNarrowsANonEmptyCollection(): void {
    const values: readonly string[] = ["value"];

    ArgumentException.throwIfEmpty(values, "values");

    Assert.areEqual(5, values[0].length);
  }
}
