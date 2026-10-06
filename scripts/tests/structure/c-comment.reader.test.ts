/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import CCommentReader from "../../structure/c-comment.reader.ts";
import LicenseHeader from "../../structure/license-header.ts";

class CCommentReaderTests {
  public static register(): void {
    test("block and line comments are found on the line they start, and the reader names the block header", () => {
      const reader = new CCommentReader();

      const lines = reader.readCommentLines([
        "#include <node_api.h>",
        "/* a block",
        "   over two lines */ static int a;",
        "static int b; // a line",
        "static int c = 4 / 2;",
        "/* last */"
      ].join("\n"));

      assert.deepEqual(lines, [2, 4, 6]);
      assert.equal(reader.header, LicenseHeader.BLOCK);
    });

    test("comment markers inside strings and character literals are no comments", () => {
      const lines = new CCommentReader().readCommentLines([
        "const char *a = \"/* not */\";",
        "const char *b = \"// not \\\" still\";",
        "char c = '/';",
        "char d = '\\'';",
        "const char *e = \"open",
        "// counted"
      ].join("\n"));

      assert.deepEqual(lines, [6]);
    });

    test("a comment or a string that does not end runs to the end of the text", () => {
      const reader = new CCommentReader();

      assert.deepEqual(reader.readCommentLines("int a;\n/* open"), [2]);
      assert.deepEqual(reader.readCommentLines("int a;\n// end"), [2]);
      assert.deepEqual(reader.readCommentLines("const char *a = \"open"), []);
    });
  }
}

CCommentReaderTests.register();
