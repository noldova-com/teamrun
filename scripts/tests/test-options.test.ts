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
import TestOptionsException from "../test-options.exception.ts";

class TestOptionsTests {
  public static register(): void {
    test("no arguments select the complete gate once", () => {
      const options = TestOptions.parse([]);

      assert.deepEqual([options.isDocuments, options.filters, options.repeat], [false, [], 1]);
    });

    test("documents alone selects the document checks", () => {
      const options = TestOptions.parse(["documents"]);

      assert.deepEqual([options.isDocuments, options.filters, options.repeat], [true, [], 1]);
    });

    test("filters accumulate in the order given and a repeat count applies to the selection", () => {
      const options = TestOptions.parse(["--filter", "alpha", "--repeat", "5", "--filter", "category:fast"]);

      assert.deepEqual([options.isDocuments, options.filters, options.repeat], [false, ["alpha", "category:fast"], 5]);
    });

    test("documents after the first argument is a filter's text, not the document checks", () => {
      const options = TestOptions.parse(["--filter", "documents"]);

      assert.deepEqual([options.isDocuments, options.filters, options.repeat], [false, ["documents"], 1]);
    });

    test("anything else is refused with the reason", () => {
      const refused: readonly (readonly [readonly string[], string])[] = [
        [["documents", "documents"], "documents takes no other option."],
        [["documents", "--repeat", "2"], "documents takes no other option."],
        [["--filter"], "--filter takes a text that is not blank and does not start with --."],
        [["--filter", ""], "--filter takes a text that is not blank and does not start with --."],
        [["--filter", " \t"], "--filter takes a text that is not blank and does not start with --."],
        [["--filter", "--repeat", "2"], "--filter takes a text that is not blank and does not start with --."],
        [["--repeat"], "--repeat takes a whole number from 1."],
        [["--repeat", "0"], "--repeat takes a whole number from 1."],
        [["--repeat", "-1"], "--repeat takes a whole number from 1."],
        [["--repeat", "2.5"], "--repeat takes a whole number from 1."],
        [["--repeat", "two"], "--repeat takes a whole number from 1."],
        [["--repeat", "2", "--repeat", "3"], "--repeat may be given only once."],
        [["coverage"], "\"coverage\" is not an option of npm test."],
        [["--filter", "alpha", "extra"], "\"extra\" is not an option of npm test."],
        [["--repeat", "2", "documents"], "\"documents\" is not an option of npm test."]
      ];

      for (const [args, reason] of refused)
        assert.throws(() => TestOptions.parse(args), new TestOptionsException(reason), args.join(" "));
    });
  }
}

TestOptionsTests.register();
