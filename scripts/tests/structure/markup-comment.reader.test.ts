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
import MarkupCommentReader from "../../structure/markup-comment.reader.ts";

class MarkupCommentReaderTests {
  public static register(): void {
    test("each comment is found on the line it starts, and the reader names the markup header", () => {
      const reader = new MarkupCommentReader();

      const lines = reader.readCommentLines("<!-- first --><p></p>\n<div>\n  <!--\n  second -->\n</div><!-- third -->\n");

      assert.deepEqual(lines, [1, 3, 5]);
      assert.deepEqual(reader.readCommentLines("<p>No comment.</p>\n"), []);
      assert.equal(reader.header, LicenseHeader.MARKUP);
    });
  }
}

MarkupCommentReaderTests.register();
