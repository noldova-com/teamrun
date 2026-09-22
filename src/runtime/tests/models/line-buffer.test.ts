/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { LineBuffer } from "@noldova/teamrun-runtime";

@TestClass
export class LineBufferTests {
  @TestMethod
  public splitsChunksIntoTrimmedLines(): void {
    const buffer = new LineBuffer();

    const first = buffer.append("a\n  b  \n\n c");
    const second = buffer.append("d\n");

    Assert.areEqual("a,b", first.join(","));
    Assert.areEqual("cd", second.join(","));
    Assert.areEqual(0, buffer.append("").length);
  }
}
