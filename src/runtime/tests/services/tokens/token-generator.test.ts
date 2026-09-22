/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TokenGenerator } from "@noldova/teamrun-runtime";

@TestClass
export class TokenGeneratorTests {
  @TestMethod
  public generatesDistinctHexadecimalTokens(): void {
    const generator = new TokenGenerator();

    const first = generator.generate();
    const second = generator.generate();

    Assert.areEqual(64, first.length);
    Assert.isTrue(/^[0-9a-f]+$/.test(first));
    Assert.areNotEqual(first, second);
  }
}
