/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import PackagingException from "../../packaging/packaging.exception.ts";

class PackagingExceptionTests {
  public static register(): void {
    test("the exception names itself and keeps its message and cause", () => {
      const cause = new Error("npm failed");
      const exception = new PackagingException("could not stage", { cause });

      assert.equal(exception.name, "PackagingException");
      assert.equal(exception.message, "could not stage");
      assert.equal(exception.cause, cause);
      assert.ok(exception instanceof Error);
    });
  }
}

PackagingExceptionTests.register();
