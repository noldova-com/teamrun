/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CapabilityToken } from "@noldova/teamrun-shell-runtime";

@TestClass
export class CapabilityTokenTests {
  @TestMethod
  public generatesThirtyTwoRandomBytesAsHex(): void {
    const first = CapabilityToken.generate();
    const second = CapabilityToken.generate();

    Assert.isTrue(/^[0-9a-f]{64}$/.test(first.value));
    Assert.areNotEqual(first.value, second.value);
  }

  @TestMethod
  public matchesOnlyItsOwnValue(): void {
    const token = new CapabilityToken("secret");

    Assert.isTrue(token.matches("secret"));
    Assert.isFalse(token.matches("secreT"));
    Assert.isFalse(token.matches("secret "));
    Assert.isFalse(token.matches(""));
  }

  @TestMethod
  public requiresAValue(): void {
    const exception = Assert.throws(() => new CapabilityToken(" "), ArgumentException);

    Assert.areEqual("token", exception.parameterName);
  }
}
