/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Cancel, FailureCode, FrameReader, FrameWriter, ProtocolException, WireDecoder } from "@noldova/teamrun-shell-protocol";

@TestClass
export class FrameWriterTests {
  @TestMethod
  public writesOneLinePerMessageThatTheReaderReadsBack(): void {
    const frames = new FrameWriter().write(new Cancel("a")) + new FrameWriter().write(new Cancel("b\nc"));

    Assert.areEqual("{\"kind\":\"Cancel\",\"id\":\"a\"}\n", new FrameWriter().write(new Cancel("a")));
    const messages = new FrameReader().read(frames).map(t => new WireDecoder().decode(t));
    Assert.areEqual("a|b\nc", messages.map(t => t instanceof Cancel ? t.id : "").join("|"));
  }

  @TestMethod
  public refusesAMessageOverTheMaximumLength(): void {
    const text = new Cancel("r1").toText();

    Assert.areEqual(`${text}\n`, new FrameWriter(text.length).write(new Cancel("r1")));
    Assert.areEqual(FailureCode.FrameTooLarge, Assert.throws(() => new FrameWriter(text.length - 1).write(new Cancel("r1")), ProtocolException).code);
  }

  @TestMethod
  public rejectsAnInvalidMaximum(): void {
    Assert.throws(() => new FrameWriter(0), ArgumentOutOfRangeException);
  }
}
