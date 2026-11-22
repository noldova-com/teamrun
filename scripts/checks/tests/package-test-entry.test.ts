/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import * as testing from "@noldova/context.testing";

import { PackageTestEntry } from "../package-test-entry.ts";
import { EntryRun } from "./fixtures/entry-run.fixture.ts";

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

const folders: string[] = [];

const runFilesAsync = async (environment: NodeJS.ProcessEnv): Promise<EntryRun> => {
  const folder = mkdtempSync(path.join(tmpdir(), "package-test-entry-"));
  folders.push(folder);
  const testing = import.meta.resolve("@noldova/context.testing");
  for (const name of ["first", "second", "third"]) {
    const className = `${name.charAt(0).toUpperCase()}${name.slice(1)}Tests`;
    writeFileSync(path.join(folder, `${name}.test.js`), [
      `import { TestClass, TestMethod } from ${JSON.stringify(testing)};`,
      `export class ${className} { passes() {} }`,
      `TestMethod(${className}.prototype.passes);`,
      `TestClass(${className});`,
      ""
    ].join("\n"));
  }
  const result = path.join(folder, "result.json");
  const exitCode = await new PackageTestEntry(["@noldova/teamrun.sample", folder], { ...environment, [PackageTestEntry.RESULT_VARIABLE]: result,
    [PackageTestEntry.SKIP_DETAILS_VARIABLE]: "true" }).runAsync();
  let files: readonly string[] = [];
  try {
    const written: unknown = JSON.parse(readFileSync(result, "utf8"));
    if (typeof written === "object" && written !== null && "files" in written && Array.isArray(written.files))
      files = written.files.map(String).sort();
  }
  catch {
    files = [];
  }
  return new EntryRun(exitCode, files);
};

describe("PackageTestEntry with isolated test files", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("runs only the one file it is given to run alone", async () => {
    const { exitCode, files } = await runFilesAsync({ [PackageTestEntry.ALONE_VARIABLE]: "@noldova/teamrun.sample/second.test.js" });

    assert.equal(exitCode, 0);
    assert.deepEqual(files, ["@noldova/teamrun.sample/second.test.js"]);
  });

  it("leaves the isolated files to their own processes when it claims test files", async () => {
    const claims = mkdtempSync(path.join(tmpdir(), "package-test-claims-"));
    folders.push(claims);
    const { exitCode, files } = await runFilesAsync({ [PackageTestEntry.CLAIMS_VARIABLE]: claims,
      [PackageTestEntry.ISOLATED_VARIABLE]: JSON.stringify(["@noldova/teamrun.sample/first.test.js", "@noldova/teamrun.sample/third.test.js"]) });

    assert.equal(exitCode, 0);
    assert.deepEqual(files, ["@noldova/teamrun.sample/second.test.js"]);
  });

  it("claims every file when none is isolated, and fails without a result when the isolated list isn't a list of files", async () => {
    const claims = mkdtempSync(path.join(tmpdir(), "package-test-claims-"));
    folders.push(claims);
    const every = await runFilesAsync({ [PackageTestEntry.CLAIMS_VARIABLE]: claims });
    const refused = await runFilesAsync({ [PackageTestEntry.CLAIMS_VARIABLE]: mkdtempSync(path.join(claims, "next-")), [PackageTestEntry.ISOLATED_VARIABLE]: "{" });

    assert.deepEqual([every.exitCode, every.files], [0, ["@noldova/teamrun.sample/first.test.js", "@noldova/teamrun.sample/second.test.js", "@noldova/teamrun.sample/third.test.js"]]);
    assert.deepEqual([refused.exitCode, refused.files], [1, []]);
  });
});
