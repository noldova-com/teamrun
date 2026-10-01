/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import TypeScriptCompiler from "../../toolchain/typescript-compiler.ts";
import SourceTreeFixture from "../fixtures/source-tree.fixture.ts";

class TypeScriptCompilerTests {
  public static register(): void {
    test("the compiler is the repository's installed TypeScript", () => {
      assert.equal(TypeScriptCompiler.locate(), path.join(SourceTreeFixture.root, "node_modules", "typescript", "bin", "tsc"));
    });
  }
}

TypeScriptCompilerTests.register();
