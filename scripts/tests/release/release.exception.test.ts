/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ReleaseException from "../../release/release.exception.ts";

class ReleaseExceptionTests {
  public static register(): void {
    test("the exception names itself and keeps its message and cause", () => {
      const cause = new Error("gh failed");
      const exception = new ReleaseException("could not publish", { cause });

      assert.equal(exception.name, "ReleaseException");
      assert.equal(exception.message, "could not publish");
      assert.equal(exception.cause, cause);
      assert.ok(exception instanceof Error);
    });
  }
}

ReleaseExceptionTests.register();
