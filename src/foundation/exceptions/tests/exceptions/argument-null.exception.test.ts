/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentNullException, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class ArgumentNullExceptionTests {
  @TestMethod
  public takesTheParameterNameFirst(): void {
    const exception = new ArgumentNullException("input");

    Assert.areEqual("input", exception.parameterName);
    Assert.areEqual("Value cannot be null or undefined. (Parameter 'input')", exception.message);
  }

  @TestMethod
  public acceptsACustomMessage(): void {
    Assert.areEqual("Missing. (Parameter 'input')", new ArgumentNullException("input", "Missing.").message);
  }

  @TestMethod
  public preservesTheCause(): void {
    const cause = new Error("cause");

    Assert.areEqual<unknown>(cause, new ArgumentNullException("input", undefined, new ExceptionOptions(cause)).cause);
  }

  @TestMethod
  public setsTheName(): void {
    Assert.areEqual("ArgumentNullException", new ArgumentNullException("input").name);
  }

  @TestMethod
  public isAnArgumentException(): void {
    Assert.isInstanceOf(new ArgumentNullException("input"), ArgumentException);
  }

  @TestMethod
  public throwIfNullThrowsForNull(): void {
    const exception = Assert.throws(() => {
      ArgumentNullException.throwIfNull(null, "input");
    }, ArgumentNullException);

    Assert.areEqual("input", exception.parameterName);
  }

  @TestMethod
  public throwIfNullThrowsForUndefined(): void {
    Assert.throws(() => {
      ArgumentNullException.throwIfNull(undefined, "input");
    }, ArgumentNullException);
  }

  @TestMethod
  public throwIfNullPassesForAValueAndNarrows(): void {
    const value: { readonly setting: string } | null = { setting: "on" };

    ArgumentNullException.throwIfNull(value, "value");

    Assert.areEqual("on", value.setting);
  }

  @TestMethod
  public throwIfNullPassesForZero(): void {
    Assert.doesNotThrow(() => {
      ArgumentNullException.throwIfNull(0, "value");
    });
  }
}
