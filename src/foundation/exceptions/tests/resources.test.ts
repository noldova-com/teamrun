/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class ResourcesTests {
  @TestMethod
  public defaultsToTheCanonicalInvalidMessage(): void {
    Assert.areEqual("Value does not fall within the expected range.", new ArgumentException().message);
  }

  @TestMethod
  public usesTheCanonicalNullMessage(): void {
    const failure = Assert.throws(() => {
      ArgumentException.throwIfNullOrWhitespace(null, "value");
    }, ArgumentException);

    Assert.areEqual("Value cannot be null or undefined. (Parameter 'value')", failure.message);
  }

  @TestMethod
  public usesTheCanonicalCollectionMessage(): void {
    const failure = Assert.throws(() => {
      ArgumentException.throwIfEmpty([], "values");
    }, ArgumentException);

    Assert.areEqual("The collection must contain at least one element. (Parameter 'values')", failure.message);
  }

  @TestMethod
  public usesTheCanonicalOutOfRangeMessage(): void {
    Assert.areEqual(
      "The argument must be within the valid range. (Parameter 'value')",
      new ArgumentOutOfRangeException("value").message);
  }

  @TestMethod
  public usesTheCanonicalEmptyMessage(): void {
    const failure = Assert.throws(() => {
      ArgumentException.throwIfNullOrWhitespace("", "value");
    }, ArgumentException);

    Assert.areEqual("The value cannot be an empty string. (Parameter 'value')", failure.message);
  }

  @TestMethod
  public usesTheCanonicalWhitespaceMessage(): void {
    const failure = Assert.throws(() => {
      ArgumentException.throwIfNullOrWhitespace(" ", "value");
    }, ArgumentException);

    Assert.areEqual("The value cannot be an empty string or composed entirely of whitespace. (Parameter 'value')", failure.message);
  }
}
