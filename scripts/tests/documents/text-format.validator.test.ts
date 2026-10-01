/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import TextFormatValidator from "../../documents/text-format.validator.ts";

class TextFormatValidatorTests {
  public static register(): void {
    test("text with LF line endings, no trailing whitespace and one final newline passes", () => {
      const validator = new TextFormatValidator();

      assert.deepEqual(validator.validate("README.md", Buffer.from("# Title\n\nText\n")), []);
      assert.deepEqual(validator.validate("one.txt", Buffer.from("x\n")), []);
    });

    test("binary content is not checked", () => {
      assert.deepEqual(new TextFormatValidator().validate("icon.png", Buffer.from([0x89, 0x50, 0x00, 0x0d, 0x0a, 0x20])), []);
    });

    test("a byte order mark, carriage returns, trailing whitespace and a wrong ending are reported with their lines", () => {
      const validator = new TextFormatValidator();

      assert.deepEqual(validator.validate("a.md", Buffer.from("﻿# Title\r\nText \r\nMore\t\nEnd")), [
        "a.md:1: starts with a byte order mark.",
        "a.md:1: uses a carriage return; lines end with LF only.",
        "a.md:2: ends with whitespace.",
        "a.md:3: ends with whitespace.",
        "a.md: does not end with a newline."
      ]);
      assert.deepEqual(validator.validate("b.md", Buffer.from("Text\n\n")), ["b.md: ends with a blank line."]);
      assert.deepEqual(validator.validate("c.md", Buffer.from("\n")), ["c.md: ends with a blank line."]);
      assert.deepEqual(validator.validate("d.md", Buffer.alloc(0)), ["d.md: does not end with a newline."]);
    });
  }
}

TextFormatValidatorTests.register();
