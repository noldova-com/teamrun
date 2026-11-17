/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TestOptions } from "../../test-options.ts";
import { TestOptionsException } from "../../test-options.exception.ts";

describe("TestOptions", () => {
  it("shows every test's and every file's details unless told to skip them", () => {
    const options = TestOptions.parse([]);

    assert.equal(options.skipsTestDetails, false);
    assert.equal(options.skipsCoverageDetails, false);
  });

  it("takes --skip-test-details and --skip-coverage-details, as the shared build-and-test workflow passes them", () => {
    const options = TestOptions.parse(["--skip-test-details", "--skip-coverage-details"]);

    assert.equal(options.skipsTestDetails, true);
    assert.equal(options.skipsCoverageDetails, true);
    assert.deepEqual(options.filters, []);
  });

  it("takes each skip option alone and with the other options", () => {
    const tests = TestOptions.parse(["--filter", "Tokens", "--skip-test-details", "--repeat", "2"]);
    const coverage = TestOptions.parse(["--skip-coverage-details", "--rerun-failed"]);

    assert.deepEqual([tests.skipsTestDetails, tests.skipsCoverageDetails, tests.filters, tests.repeat], [true, false, ["Tokens"], 2]);
    assert.deepEqual([coverage.skipsTestDetails, coverage.skipsCoverageDetails, coverage.isRerunningFailed], [false, true, true]);
  });

  it("refuses a skip option with documents or angular, which take no other option", () => {
    assert.throws(() => TestOptions.parse(["documents", "--skip-test-details"]), (error: unknown) => error instanceof TestOptionsException && error.message === "documents takes no other option.");
    assert.throws(() => TestOptions.parse(["angular", "--skip-coverage-details"]), (error: unknown) => error instanceof TestOptionsException && error.message === "angular takes no other option.");
  });

  it("still refuses an option npm test doesn't have", () => {
    assert.throws(() => TestOptions.parse(["--skip-details"]), (error: unknown) => error instanceof TestOptionsException && error.message === "\"--skip-details\" is not an option of npm test.");
  });
});
