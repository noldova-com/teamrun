/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ProcessTimeoutException from "../../processes/process-timeout.exception.ts";
import ProcessException from "../../processes/process.exception.ts";

class ProcessTimeoutExceptionTests {
  public static register(): void {
    test("the exception names itself, keeps its message and is a process failure", () => {
      const exception = new ProcessTimeoutException("\"gh\" did not finish within 300 ms.");

      assert.equal(exception.name, "ProcessTimeoutException");
      assert.equal(exception.message, "\"gh\" did not finish within 300 ms.");
      assert.ok(exception instanceof ProcessException);
    });
  }
}

ProcessTimeoutExceptionTests.register();
