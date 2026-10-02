/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ScannedSource from "../../structure/scanned-source.ts";
import SourceLiteral from "../../structure/source-literal.ts";

class ScannedSourceTests {
  public static register(): void {
    test("a scanned source keeps its imports, selectors and other strings apart", () => {
      const imports = [new SourceLiteral("node:fs", 1)];
      const selectors = [new SourceLiteral("tr-panel", 2)];
      const texts = [new SourceLiteral("Panel", 3)];

      const source = new ScannedSource(imports, selectors, texts);

      assert.equal(source.imports, imports);
      assert.equal(source.selectors, selectors);
      assert.equal(source.texts, texts);
    });
  }
}

ScannedSourceTests.register();
