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

      assert.deepEqual([options.isDocuments, options.filters, options.repeat, options.part, options.isRerunningFailed], [false, [], 1, null, false]);
    });

    test("a part selects its checks, once, repeated or rerunning its failed tests", () => {
      const once = TestOptions.parse(["--part", "packages"]);
      const repeated = TestOptions.parse(["--repeat", "3", "--part", "angular-and-checks"]);
      const rerunning = TestOptions.parse(["--part", "scripts", "--rerun-failed"]);

      assert.deepEqual([once.isDocuments, once.filters, once.repeat, once.part, once.isRerunningFailed], [false, [], 1, "packages", false]);
      assert.deepEqual([repeated.isDocuments, repeated.filters, repeated.repeat, repeated.part], [false, [], 3, "angular-and-checks"]);
      assert.deepEqual([rerunning.filters, rerunning.repeat, rerunning.part, rerunning.isRerunningFailed], [[], 1, "scripts", true]);
    });

    test("documents alone selects the document checks", () => {
      const options = TestOptions.parse(["documents"]);

      assert.deepEqual([options.isDocuments, options.filters, options.repeat, options.isRerunningFailed], [true, [], 1, false]);
    });

    test("filters accumulate in the order given and a repeat count applies to the selection", () => {
      const options = TestOptions.parse(["--filter", "alpha", "--repeat", "5", "--filter", "category:fast"]);

      assert.deepEqual([options.isDocuments, options.filters, options.repeat], [false, ["alpha", "category:fast"], 5]);
    });

    test("--rerun-failed takes no value and goes with the complete gate or a selection, wherever it is given", () => {
      const alone = TestOptions.parse(["--rerun-failed"]);
      const between = TestOptions.parse(["--filter", "alpha", "--rerun-failed", "--repeat", "2"]);

      assert.deepEqual([alone.filters, alone.repeat, alone.isRerunningFailed], [[], 1, true]);
      assert.deepEqual([between.filters, between.repeat, between.isRerunningFailed], [["alpha"], 2, true]);
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
        [["--rerun-failed", "--rerun-failed"], "--rerun-failed may be given only once."],
        [["documents", "--rerun-failed"], "documents takes no other option."],
        [["--part"], "--part takes one of packages, scripts, angular-and-checks."],
        [["--part", "ui"], "--part takes one of packages, scripts, angular-and-checks."],
        [["--part", "scripts", "--part", "packages"], "--part may be given only once."],
        [["--part", "scripts", "--filter", "alpha"], "--part runs a whole part, so it takes no --filter."],
        [["--filter", "alpha", "--part", "scripts"], "--part runs a whole part, so it takes no --filter."],
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
