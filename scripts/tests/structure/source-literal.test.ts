/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import SourceLiteral from "../../structure/source-literal.ts";

class SourceLiteralTests {
  public static register(): void {
    test("a literal keeps its value and line", () => {
      const literal = new SourceLiteral("tr-panel", 4);

      assert.equal(literal.value, "tr-panel");
      assert.equal(literal.line, 4);
    });
  }
}

SourceLiteralTests.register();
