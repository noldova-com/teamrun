/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import FlakyFilingException from "../../workflows/flaky-filing.exception.ts";

class FlakyFilingExceptionTests {
  public static register(): void {
    test("the exception names itself, keeps what was filed and its cause, and says why the filing stopped", () => {
      const cause = new Error("HTTP 502");
      const exception = new FlakyFilingException(["- a: opened #1"], cause);

      assert.deepEqual([exception.name, exception.message, exception.filed, exception.cause], ["FlakyFilingException", "Filing the flaky tests stopped: HTTP 502", ["- a: opened #1"], cause]);
      assert.ok(exception instanceof Error);
    });
  }
}

FlakyFilingExceptionTests.register();
