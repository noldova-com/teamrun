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

      assert.deepEqual([options.isDocuments, options.filters, options.repeat, options.selection], [false, [], 1, undefined]);
    });

    test("packages, the Angular tests and the script tests select a run of every check with only those tests, which a repeat count applies to", () => {
      const options = TestOptions.parse(["--package", "@noldova/teamrun-foundation-core", "--script-tests", "--repeat", "2", "--package", "@noldova/teamrun-shell-protocol", "--angular-tests"]);
      const scripts = TestOptions.parse(["--script-tests"]).selection;
      const checksOnly = TestOptions.parse(["--checks-only"]);

      assert.deepEqual([options.isDocuments, options.filters, options.repeat], [false, [], 2]);
      assert.deepEqual(options.selection?.packages, ["@noldova/teamrun-foundation-core", "@noldova/teamrun-shell-protocol"]);
      assert.deepEqual([options.selection?.runsAngularTests, options.selection?.runsScriptTests], [true, true]);
      assert.deepEqual([scripts?.packages, scripts?.runsAngularTests, scripts?.runsScriptTests], [[], false, true]);
      assert.deepEqual([checksOnly.repeat, checksOnly.selection?.packages, checksOnly.selection?.runsAngularTests, checksOnly.selection?.runsScriptTests], [1, [], false, false]);
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
        [["--repeat", "2", "documents"], "\"documents\" is not an option of npm test."],
        [["--package"], "--package takes a package's name that is not blank and does not start with --."],
        [["--package", " "], "--package takes a package's name that is not blank and does not start with --."],
        [["--package", "--script-tests"], "--package takes a package's name that is not blank and does not start with --."],
        [["--filter", "alpha", "--package", "@noldova/teamrun-foundation-core"], "--filter selects tests by name and takes no --package, --angular-tests, --script-tests or --checks-only."],
        [["--angular-tests", "--filter", "alpha"], "--filter selects tests by name and takes no --package, --angular-tests, --script-tests or --checks-only."],
        [["--filter", "alpha", "--checks-only"], "--filter selects tests by name and takes no --package, --angular-tests, --script-tests or --checks-only."],
        [["--checks-only", "--script-tests"], "--checks-only runs no tests, so it takes no --package, --angular-tests or --script-tests."],
        [["--package", "@noldova/teamrun-foundation-core", "--checks-only"], "--checks-only runs no tests, so it takes no --package, --angular-tests or --script-tests."]
      ];

      for (const [args, reason] of refused)
        assert.throws(() => TestOptions.parse(args), new TestOptionsException(reason), args.join(" "));
    });
  }
}

TestOptionsTests.register();
