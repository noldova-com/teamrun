/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-text";
import { nameof } from "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class StringExtensionsTests {
  @TestMethod
  public recognizesEveryAsciiBinaryDigit(): void {
    for (const character of "01")
      Assert.isTrue(String.isAsciiBinaryDigit(character));
  }

  @TestMethod
  public rejectsValuesThatAreNotSingleAsciiBinaryDigits(): void {
    Assert.isFalse(String.isAsciiBinaryDigit(String.empty));
    Assert.isFalse(String.isAsciiBinaryDigit("01"));
    Assert.isFalse(String.isAsciiBinaryDigit("2"));
    Assert.isFalse(String.isAsciiBinaryDigit("\u0660"));
  }

  @TestMethod
  public recognizesEveryAsciiOctalDigit(): void {
    for (const character of "01234567")
      Assert.isTrue(String.isAsciiOctalDigit(character));
  }

  @TestMethod
  public rejectsValuesThatAreNotSingleAsciiOctalDigits(): void {
    Assert.isFalse(String.isAsciiOctalDigit(String.empty));
    Assert.isFalse(String.isAsciiOctalDigit("07"));
    Assert.isFalse(String.isAsciiOctalDigit("8"));
    Assert.isFalse(String.isAsciiOctalDigit("\u0660"));
  }

  @TestMethod
  public installsTheCharacterClassifiersImmutably(): void {
    const asciiBinaryDigitDescriptor = Object.getOwnPropertyDescriptor(String, nameof<StringConstructor>(t => t.isAsciiBinaryDigit));
    const asciiOctalDigitDescriptor = Object.getOwnPropertyDescriptor(String, nameof<StringConstructor>(t => t.isAsciiOctalDigit));

    Assert.isDefined(asciiBinaryDigitDescriptor);
    Assert.areEqual<boolean | undefined>(false, asciiBinaryDigitDescriptor.writable);
    Assert.areEqual<boolean | undefined>(false, asciiBinaryDigitDescriptor.enumerable);
    Assert.areEqual<boolean | undefined>(false, asciiBinaryDigitDescriptor.configurable);
    Assert.isDefined(asciiOctalDigitDescriptor);
    Assert.areEqual<boolean | undefined>(false, asciiOctalDigitDescriptor.writable);
    Assert.areEqual<boolean | undefined>(false, asciiOctalDigitDescriptor.enumerable);
    Assert.areEqual<boolean | undefined>(false, asciiOctalDigitDescriptor.configurable);
  }
}
