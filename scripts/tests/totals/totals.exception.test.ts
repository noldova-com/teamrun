/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import TotalsException from "../../totals/totals.exception.ts";

class TotalsExceptionTests {
  public static register(): void {
    test("the exception names itself and keeps its message and cause", () => {
      const cause = new SyntaxError("Unexpected end of JSON input");
      const exception = new TotalsException("The record is not JSON.", { cause });

      assert.equal(exception.name, "TotalsException");
      assert.equal(exception.message, "The record is not JSON.");
      assert.equal(exception.cause, cause);
      assert.ok(exception instanceof Error);
    });
  }
}

TotalsExceptionTests.register();
