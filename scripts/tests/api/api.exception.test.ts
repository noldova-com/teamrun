/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ApiException from "../../api/api.exception.ts";

class ApiExceptionTests {
  public static register(): void {
    test("the exception keeps its message, name and cause", () => {
      const cause = new Error("inner");
      const exception = new ApiException("outer", { cause });

      assert.deepEqual([exception.message, exception.name, exception.cause], ["outer", "ApiException", cause]);
    });

    test("a failure is described by its message, and anything else by its text", () => {
      assert.equal(ApiException.describe(new RangeError("out of range")), "out of range");
      assert.equal(ApiException.describe("plain"), "plain");
    });
  }
}

ApiExceptionTests.register();
