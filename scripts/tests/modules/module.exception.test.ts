/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ModuleException from "../../modules/module.exception.ts";

class ModuleExceptionTests {
  public static register(): void {
    test("the exception names itself and keeps its message and cause", () => {
      const cause = new Error("unreadable");
      const exception = new ModuleException("bad declaration", { cause });

      assert.equal(exception.name, "ModuleException");
      assert.equal(exception.message, "bad declaration");
      assert.equal(exception.cause, cause);
    });
  }
}

ModuleExceptionTests.register();
