/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import FlakyRedactor from "../../workflows/flaky-redactor.ts";

class FlakyRedactorTests {
  public static register(): void {
    test("the home folder shows as a tilde with either separator and in any case, as the runtime's diagnostic redactor shows it", () => {
      const redactor = new FlakyRedactor(["C:\\Users\\Person (1)"]);

      assert.equal(redactor.redact("C:\\Users\\Person (1)\\notes and c:/users/person (1)/notes and C:/USERS\\PERSON (1)\\x"), "~\\notes and ~/notes and ~\\x");
    });

    test("opaque values are replaced and shorter words kept, as the runtime's diagnostic redactor replaces them", () => {
      const redactor = new FlakyRedactor(["/home/person"]);

      assert.equal(redactor.redact(`token ${"a1B2_c3D4-".repeat(4)} for /home/other, id abc-123`), "token [redacted] for /home/other, id abc-123");
    });

    test("each GitHub runner's home folder is shortened", () => {
      const redactor = new FlakyRedactor(FlakyRedactor.RUNNER_HOMES);

      assert.equal(redactor.redact("/home/runner/work/a.ts /Users/runner/work/b.ts C:\\Users\\runneradmin\\work\\c.ts"), "~/work/a.ts ~/work/b.ts ~\\work\\c.ts");
    });
  }
}

FlakyRedactorTests.register();
