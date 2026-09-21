/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TailBuffer } from "@noldova/teamrun-providers";

@TestClass
export class TailBufferTests {
  @TestMethod
  public keepsTheLastChunks(): void {
    const buffer = new TailBuffer(2);

    Assert.isTrue(buffer.isEmpty);
    buffer.push("a");
    buffer.push("b");
    buffer.push("c");

    Assert.areEqual("bc", buffer.toString());
    Assert.isFalse(buffer.isEmpty);
    Assert.throws(() => new TailBuffer(-1), ArgumentOutOfRangeException);
  }
}
