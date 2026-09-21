/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { BoundedOutput } from "@noldova/teamrun-providers";

@TestClass
export class BoundedOutputTests {
  @TestMethod
  public keepsOnlyTheFirstCharacters(): void {
    const output = new BoundedOutput(5);

    output.append("abc");
    output.append("defg");
    output.append("h");

    Assert.areEqual("abcde", output.toString());
    Assert.isTrue(output.isFull);
    Assert.throws(() => new BoundedOutput(0), ArgumentOutOfRangeException);
  }
}
