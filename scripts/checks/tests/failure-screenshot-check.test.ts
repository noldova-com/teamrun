/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

import { ShortScreenshotNames } from "../../angular/short-screenshot-names.ts";
import { ProcessResult } from "../../processes/process-result.ts";
import { FailureScreenshotCheck } from "../failure-screenshot-check.ts";

const longName = `${"fails-with-a-title-past-what-a-file-name-may-hold-".repeat(6)}and-keeps-its-screenshot-1.png`;
const shortName = path.basename(ShortScreenshotNames.shorten(longName));
const folder = path.join(path.sep, "work", "failure-screenshots", "long-title.fixture.ts");
const logLine = `Screenshot of "${longName}": ${path.join(folder, shortName)}`;
const failed = (output: string): ProcessResult => new ProcessResult(1, `FAIL long-title.fixture.ts\n${output}\n`, "");

describe("FailureScreenshotCheck", () => {
  it("passes a failed run that saved one screenshot under the cut name and logged the long name beside its path", () => {
    assert.deepEqual(FailureScreenshotCheck.findingsOf(failed(logLine), [shortName]), []);
  });

  it("fails a run that didn't fail its one test, whatever it saved", () => {
    const findings = FailureScreenshotCheck.findingsOf(new ProcessResult(0, logLine, ""), [shortName]);

    assert.equal(findings.length, 1);
    assert.match(findings[0] ?? "", /^The fixture's run should fail its one test and exit with 1, but exited with 0:/u);
  });

  it("fails a run that saved no screenshot, two, or one under the long name", () => {
    for (const files of [[], [shortName, "other.png"], [longName]]) {
      const findings = FailureScreenshotCheck.findingsOf(failed(logLine), files);

      assert.equal(findings.some(t => t.startsWith("The failed test should leave one screenshot named with the start of its title and 16 hexadecimal digits")), true,
        JSON.stringify(files));
    }
  });

  it("fails a run that didn't log the long name, logged a name that fits, or logged another file's path", () => {
    for (const output of ["", `Screenshot of "short.png": ${path.join(folder, shortName)}`, `Screenshot of "${longName}": ${path.join(folder, "other.png")}`]) {
      const findings = FailureScreenshotCheck.findingsOf(failed(output), [shortName]);

      assert.deepEqual(findings.map(t => t.split(":")[0]), [`The run should print "Screenshot of" the test's name, past 255 bytes, beside the saved screenshot's path`], output);
    }
  });
});
