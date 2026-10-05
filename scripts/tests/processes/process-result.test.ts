/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ProcessResult from "../../processes/process-result.ts";

class ProcessResultTests {
  public static register(): void {
    test("only a zero exit code is successful, and a process without an exit code is not", () => {
      const result = new ProcessResult(0, "out", "err");

      assert.equal(result.isSuccessful, true);
      assert.equal(result.output, "out");
      assert.equal(result.errorOutput, "err");
      assert.equal(new ProcessResult(1, "", "").isSuccessful, false);
      assert.equal(new ProcessResult(null, "", "").isSuccessful, false);
    });

    test("the text is the output followed by the error output, without surrounding white space", () => {
      assert.equal(new ProcessResult(1, "\nout\n", "err\n").text, "out\nerr");
    });
  }
}

ProcessResultTests.register();
