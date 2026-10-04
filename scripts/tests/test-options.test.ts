/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import TestOptions from "../test-options.ts";

class TestOptionsTests {
  public static register(): void {
    test("no arguments select the complete gate once", () => {
      const options = TestOptions.parse([]);

      assert.deepEqual([options?.isDocuments, options?.filters, options?.repeat], [false, [], 1]);
    });

    test("documents alone selects the document checks", () => {
      const options = TestOptions.parse(["documents"]);

      assert.deepEqual([options?.isDocuments, options?.filters, options?.repeat], [true, [], 1]);
    });

    test("filters accumulate in the order given and a repeat count applies to the selection", () => {
      const options = TestOptions.parse(["--filter", "alpha", "--repeat", "5", "--filter", "category:fast"]);

      assert.deepEqual([options?.isDocuments, options?.filters, options?.repeat], [false, ["alpha", "category:fast"], 5]);
    });

    test("anything else is refused", () => {
      const refused = [
        ["coverage"], ["documents", "documents"], ["documents", "--repeat", "2"], ["--filter"], ["--filter", ""], ["--repeat"],
        ["--repeat", "0"], ["--repeat", "-1"], ["--repeat", "2.5"], ["--repeat", "two"], ["--repeat", "2", "--repeat", "3"], ["alpha"], ["--filter", "alpha", "extra"]
      ];

      for (const args of refused)
        assert.equal(TestOptions.parse(args), null, args.join(" "));
    });
  }
}

TestOptionsTests.register();
