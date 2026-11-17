/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { CommandOutputDecoder } from "@noldova/teamrun.providers";

@TestClass
export class CommandOutputDecoderTests {
  @TestMethod
  @TestData("A\0c\0c\0e\0s\0s\0 \0i\0s\0 \0d\0e\0n\0i\0e\0d\0\r\0\n\0", "Access is denied\r\n")
  @TestData("\uFFFD\uFFFDO\0K\0", "OK")
  @TestData("\uFEFFO\0K\0", "OK")
  @TestData("\0A\0c\0c\0e\0s\0s\0 \0i\0s\0 \0d\0e\0n\0i\0e\0d\0\r\0\n", "Access is denied\r\n")
  @TestData("\uFFFD\uFFFD\0O\0K", "OK")
  @TestData("ok\n\0E\0r\0r\0o\0r\0\nok", "ok\nError\nok")
  @TestData("ok\n\uFFFD\uFFFD\0O\0K", "ok\nOK")
  @TestData("W\0o\0r\0d\0", "Word")
  @TestData("\0W\0o\0r\0d", "Word")
  @TestData("ok\nE\0r\0r\0o\0r\0\nok", "ok\nError\nok")
  @TestData("Access is denied", "Access is denied")
  @TestData("h\u00e9llo \u2014 \u4e2d", "h\u00e9llo \u2014 \u4e2d")
  @TestData("a\0b\0c\0 then x\0y", "a\0b\0c\0 then x\0y")
  @TestData("", "")
  public decodesUtf16RunsAndLeavesTheRestAsItIs(text: string, expected: string): void {
    Assert.areEqual(expected, CommandOutputDecoder.decode(text));
  }
}
