/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ProcessException from "../../processes/process.exception.ts";

class ProcessExceptionTests {
  public static register(): void {
    test("the exception names itself and keeps its message and cause", () => {
      const cause = new Error("spawn failed");
      const exception = new ProcessException("could not start", { cause });

      assert.equal(exception.name, "ProcessException");
      assert.equal(exception.message, "could not start");
      assert.equal(exception.cause, cause);
      assert.ok(exception instanceof Error);
    });
  }
}

ProcessExceptionTests.register();
