/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import FlakyRecordException from "../../checks/flaky-record.exception.ts";

class FlakyRecordExceptionTests {
  public static register(): void {
    test("the exception names itself and keeps its message and cause", () => {
      const cause = new SyntaxError("not JSON");
      const exception = new FlakyRecordException("unreadable", { cause });

      assert.equal(exception.name, "FlakyRecordException");
      assert.equal(exception.message, "unreadable");
      assert.equal(exception.cause, cause);
      assert.ok(exception instanceof Error);
    });
  }
}

FlakyRecordExceptionTests.register();
