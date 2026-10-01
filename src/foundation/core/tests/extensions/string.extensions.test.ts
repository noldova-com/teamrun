/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nameof } from "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class StringExtensionsTests {
  @TestMethod
  public emptyIsTheEmptyString(): void {
    Assert.areEqual("", String.empty);
  }

  @TestMethod
  public emptyIsImmutable(): void {
    const descriptor = Object.getOwnPropertyDescriptor(String, nameof<StringConstructor>(t => t.empty));

    Assert.isDefined(descriptor);
    Assert.areEqual<boolean | undefined>(false, descriptor.writable);
    Assert.areEqual<boolean | undefined>(false, descriptor.enumerable);
    Assert.areEqual<boolean | undefined>(false, descriptor.configurable);
  }

  @TestMethod
  public isNullOrEmptyReturnsTrueForNull(): void {
    Assert.isTrue(String.isNullOrEmpty(null));
  }

  @TestMethod
  public isNullOrEmptyReturnsTrueForUndefined(): void {
    Assert.isTrue(String.isNullOrEmpty(undefined));
  }

  @TestMethod
  public isNullOrEmptyReturnsTrueForTheEmptyString(): void {
    Assert.isTrue(String.isNullOrEmpty(String.empty));
  }

  @TestMethod
  public isNullOrEmptyReturnsFalseForWhitespace(): void {
    Assert.isFalse(String.isNullOrEmpty(" "));
  }

  @TestMethod
  public isNullOrEmptyReturnsFalseForText(): void {
    Assert.isFalse(String.isNullOrEmpty("value"));
  }

  @TestMethod
  public isNullOrEmptyNarrowsWhenFalse(): void {
    const value: string | null | undefined = "value";

    if (String.isNullOrEmpty(value))
      Assert.fail("The value is neither null nor empty.");

    Assert.areEqual(5, value.length);
  }

  @TestMethod
  public isNullOrWhitespaceReturnsTrueForNull(): void {
    Assert.isTrue(String.isNullOrWhitespace(null));
  }

  @TestMethod
  public isNullOrWhitespaceReturnsTrueForUndefined(): void {
    Assert.isTrue(String.isNullOrWhitespace(undefined));
  }

  @TestMethod
  public isNullOrWhitespaceReturnsTrueForTheEmptyString(): void {
    Assert.isTrue(String.isNullOrWhitespace(String.empty));
  }

  @TestMethod
  public isNullOrWhitespaceReturnsTrueForWhitespace(): void {
    Assert.isTrue(String.isNullOrWhitespace(" \t\r\n "));
  }

  @TestMethod
  public isNullOrWhitespaceReturnsFalseForPaddedText(): void {
    Assert.isFalse(String.isNullOrWhitespace(" value "));
  }
}
