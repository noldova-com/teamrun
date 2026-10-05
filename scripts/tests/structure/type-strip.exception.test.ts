/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import TypeStripException from "../../structure/type-strip.exception.ts";

class TypeStripExceptionTests {
  public static register(): void {
    test("the exception names itself and keeps its message and cause", () => {
      const cause = new Error("unexpected token");
      const exception = new TypeStripException("could not strip", { cause });

      assert.equal(exception.name, "TypeStripException");
      assert.equal(exception.message, "could not strip");
      assert.equal(exception.cause, cause);
      assert.ok(exception instanceof Error);
    });
  }
}

TypeStripExceptionTests.register();
