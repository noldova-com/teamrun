/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import PackageException from "../../packages/package.exception.ts";

class PackageExceptionTests {
  public static register(): void {
    test("the exception names itself and keeps its message and cause", () => {
      const cause = new Error("unreadable");
      const exception = new PackageException("bad manifest", { cause });

      assert.equal(exception.name, "PackageException");
      assert.equal(exception.message, "bad manifest");
      assert.equal(exception.cause, cause);
    });
  }
}

PackageExceptionTests.register();
