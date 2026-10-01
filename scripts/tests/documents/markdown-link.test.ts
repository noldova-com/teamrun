/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import MarkdownLink from "../../documents/markdown-link.ts";

class MarkdownLinkTests {
  public static register(): void {
    test("a link keeps its target and the line it appears on", () => {
      const link = new MarkdownLink("docs/TESTING.md#6-verification-scope", 12);

      assert.equal(link.target, "docs/TESTING.md#6-verification-scope");
      assert.equal(link.line, 12);
    });
  }
}

MarkdownLinkTests.register();
