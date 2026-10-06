/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import LicenseHeader from "../../structure/license-header.ts";
import ScriptCommentReader from "../../structure/script-comment.reader.ts";

class ScriptCommentReaderTests {
  public static register(): void {
    test("line and block comments are found on the line they start, but not markers in strings, templates or regular expressions", () => {
      const reader = new ScriptCommentReader();

      const lines = reader.readCommentLines([
        "const url = \"https://example.com\";",
        "const block = `/* ${url} // */`;",
        "const pattern = /\\/\\/ or \\/\\*/;",
        "// a line",
        "const value = 1; /* a block",
        "over two lines */",
        "const half = value / 2; // after code"
      ].join("\n"));

      assert.deepEqual(lines, [4, 5, 7]);
      assert.equal(reader.header, LicenseHeader.BLOCK);
    });
  }
}

ScriptCommentReaderTests.register();
