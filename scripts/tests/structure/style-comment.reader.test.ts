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
import StyleCommentReader from "../../structure/style-comment.reader.ts";

class StyleCommentReaderTests {
  public static register(): void {
    test("block and line comments are found on the line they start, and the reader names the block header", () => {
      const reader = new StyleCommentReader();

      const lines = reader.readCommentLines([
        ":root {",
        "  /* a block",
        "     over two lines */ color: red;",
        "  // a line",
        "}",
        "/* last */"
      ].join("\n"));

      assert.deepEqual(lines, [2, 4, 6]);
      assert.equal(reader.header, LicenseHeader.BLOCK);
    });

    test("comment markers inside strings and unquoted URLs are no comments", () => {
      const lines = new StyleCommentReader().readCommentLines([
        ".a { content: \"/* not */\"; }",
        ".b { content: '// not \\' still'; }",
        ".c { background: url(//cdn.example/a.png); }",
        ".d { content: \"open",
        "// counted"
      ].join("\n"));

      assert.deepEqual(lines, [5]);
    });

    test("a comment, a string or a URL that does not end runs to the end of the text", () => {
      const reader = new StyleCommentReader();

      assert.deepEqual(reader.readCommentLines(".a {}\n/* open"), [2]);
      assert.deepEqual(reader.readCommentLines(".a {}\n// end"), [2]);
      assert.deepEqual(reader.readCommentLines(".a { content: \"open"), []);
      assert.deepEqual(reader.readCommentLines(".a { background: url(//open"), []);
    });
  }
}

StyleCommentReaderTests.register();
