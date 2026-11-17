/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as testing from "@noldova/context.testing";

import { PackageTestEntry } from "../package-test-entry.ts";

const reportPassingClass = (environment: NodeJS.ProcessEnv): string => {
  let text = "";
  const reporter = new PackageTestEntry([], environment).createReporter(testing, t => { text += t; }, false);
  const method = new testing.TestMethodResult("Sample", "SampleTests", "passesQuietly", undefined, [], testing.TestOutcome.Passed, 2, undefined, undefined);
  reporter.onClassCompleted(new testing.TestClassResult("Sample", "SampleTests", "sample.test.js", [method]));
  return text;
};

describe("PackageTestEntry's reporter", () => {
  it("lists a passing test unless the run skips test details", () => {
    assert.match(reportPassingClass({}), /passesQuietly/u);
    assert.match(reportPassingClass({ [PackageTestEntry.SKIP_DETAILS_VARIABLE]: "false" }), /passesQuietly/u);
  });

  it("leaves a passing test out when the run skips test details", () => {
    assert.doesNotMatch(reportPassingClass({ [PackageTestEntry.SKIP_DETAILS_VARIABLE]: "true" }), /passesQuietly/u);
  });

  it("still lists a failing test, a skipped test and the run's totals when the run skips test details", () => {
    let text = "";
    const reporter = new PackageTestEntry([], { [PackageTestEntry.SKIP_DETAILS_VARIABLE]: "true" }).createReporter(testing, t => { text += t; }, false);
    const passing = new testing.TestMethodResult("Sample", "SampleTests", "passesQuietly", undefined, [], testing.TestOutcome.Passed, 2, undefined, undefined);
    const failing = new testing.TestMethodResult("Sample", "SampleTests", "failsLoudly", undefined, [], testing.TestOutcome.Failed, 2, new Error("Broken."), undefined);
    const skipped = new testing.TestMethodResult("Sample", "SampleTests", "waitsForAServer", undefined, [], testing.TestOutcome.Skipped, 0, undefined, "Server unavailable.");
    const result = new testing.TestClassResult("Sample", "SampleTests", "sample.test.js", [passing, failing, skipped]);
    reporter.onClassCompleted(result);
    reporter.writeSummary(new testing.TestRunResult([result]));

    assert.doesNotMatch(text, /passesQuietly/u);
    assert.match(text, /failsLoudly/u);
    assert.match(text, /waitsForAServer/u);
    assert.match(text, /Server unavailable\./u);
    assert.match(text, /Total:\s+3/u);
    assert.match(text, /Passed:\s+1/u);
    assert.match(text, /Failed:\s+1/u);
    assert.match(text, /Skipped:\s+1/u);
  });
});
