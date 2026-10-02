/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { FailureCode, FrameReader, ProtocolException } from "@noldova/teamrun-shell-protocol";

@TestClass
export class FrameReaderTests {
  @TestMethod
  public splitsChunksIntoFrames(): void {
    const reader = new FrameReader();

    Assert.areEqual("", reader.read("{\"a\"").join("|"));
    Assert.areEqual("{\"a\":1}|{\"b\":2}", reader.read(":1}\n{\"b\":2}\n{\"c\"").join("|"));
    Assert.areEqual("{\"c\":3}", reader.read(":3}\n").join("|"));
  }

  @TestMethod
  public skipsBlankLines(): void {
    Assert.areEqual("x|y", new FrameReader().read("\n  \nx\n\r\ny\n").join("|"));
  }

  @TestMethod
  public acceptsAFrameOfExactlyTheMaximumLength(): void {
    Assert.areEqual("1234", new FrameReader(4).read("1234\n").join("|"));
  }

  @TestMethod
  @TestData("12345\n")
  @TestData("12345")
  @TestData("12\n12345")
  public refusesAnOversizedFrame(chunk: string): void {
    const failure = Assert.throws(() => new FrameReader(4).read(chunk), ProtocolException);

    Assert.areEqual(FailureCode.FrameTooLarge, failure.code);
  }

  @TestMethod
  public refusesAFrameThatGrowsAcrossChunks(): void {
    const reader = new FrameReader(4);
    reader.read("123");

    Assert.areEqual(FailureCode.FrameTooLarge, Assert.throws(() => reader.read("45"), ProtocolException).code);
  }

  @TestMethod
  @TestData(0)
  @TestData(-1)
  @TestData(2.5)
  public rejectsAnInvalidMaximum(maximum: number): void {
    Assert.throws(() => new FrameReader(maximum), ArgumentOutOfRangeException);
  }
}
