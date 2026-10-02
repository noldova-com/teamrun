/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import SourceFile from "../../structure/source-file.ts";

class SourceFileTests {
  public static register(): void {
    test("a source file keeps its owner, role, package and text", () => {
      const file = new SourceFile("src/modules/alpha/window/src/view.ts", "alpha", false, "src/modules/alpha/window", "text");

      assert.equal(file.path, "src/modules/alpha/window/src/view.ts");
      assert.equal(file.owner, "alpha");
      assert.equal(file.isProduction, false);
      assert.equal(file.packageRoot, "src/modules/alpha/window");
      assert.equal(file.text, "text");
      assert.equal(file.formatLocation(7), "src/modules/alpha/window/src/view.ts:7");
    });

    test("the extension tells scripts, styles, JSON and manifests apart", () => {
      const kinds = (name: string): string => {
        const file = new SourceFile(name, "shell", true, "src/shell", "");
        return [file.isScript, file.isStyle, file.isJson, file.isManifest].map(t => t ? "1" : "0").join("");
      };

      assert.deepEqual(
        ["a.ts", "a.mts", "a.cts", "a.js", "a.mjs", "a.cjs", "a.css", "a.scss", "tsconfig.json", "x/package.json", "a.html"].map(kinds),
        ["1000", "1000", "1000", "1000", "1000", "1000", "0100", "0100", "0010", "0011", "0000"]);
    });
  }
}

SourceFileTests.register();
