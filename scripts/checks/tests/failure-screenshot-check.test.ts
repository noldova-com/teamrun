/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import { describe, it } from "node:test";

import { ShortScreenshotNames } from "../../angular/short-screenshot-names.ts";
import { ProcessResult } from "../../processes/process-result.ts";
import { ProcessRunner } from "../../processes/process-runner.ts";
import { FailureScreenshotCheck } from "../failure-screenshot-check.ts";

const longName = `${"fails-with-a-title-past-what-a-file-name-may-hold-".repeat(6)}and-keeps-its-screenshot-1.png`;
const shortName = path.basename(ShortScreenshotNames.shorten(longName));
const folder = path.join(path.sep, "work", "failure-screenshots", "long-title.fixture.ts");
const logLine = `Screenshot of "${longName}": ${path.join(folder, shortName)}`;
const failed = (output: string): ProcessResult => new ProcessResult(1, `FAIL long-title.fixture.ts\n${output}\n`, "");
const noTest = new ProcessResult(1, " Test Files  (1)\n\u001b[2m      Tests \u001b[22m \u001b[2mno tests\u001b[22m\n Errors  1 error\npage.goto: net::ERR_NO_BUFFER_SPACE\n", "");

class ScriptedRunner extends ProcessRunner {
  public runs: number = 0;
  private readonly results: readonly ProcessResult[];

  public constructor(results: readonly ProcessResult[]) {
    super();
    this.results = results;
  }

  public override async captureAsync(_command: string, _commandArguments: readonly string[], _directory: string, _timeout: number,
    environment?: NodeJS.ProcessEnv): Promise<ProcessResult> {
    const result = this.results[this.runs] ?? noTest;
    this.runs++;
    const attachments = environment?.["NOLDOVA_FAILURE_SCREENSHOT_ATTACHMENTS"] ?? "";
    if (result !== noTest) {
      await mkdir(path.join(attachments, "failure-screenshots", "long-title.fixture.ts"), { recursive: true });
      await writeFile(path.join(attachments, "failure-screenshots", "long-title.fixture.ts", shortName), "");
    }
    return result;
  }
}

const runAsync = async (results: readonly ProcessResult[]): Promise<readonly [boolean, number, string]> => {
  const root = await mkdtemp(path.join(tmpdir(), "failure-screenshot-check-"));
  try {
    const runner = new ScriptedRunner(results);
    let written = "";
    const output = new Writable({
      write: (chunk: Buffer, _encoding, done): void => {
        written += chunk.toString();
        done();
      }
    });
    const passed = await new FailureScreenshotCheck(root, runner).runAsync(output);
    return [passed, runner.runs, written];
  }
  finally {
    await rm(root, { recursive: true, force: true });
  }
};

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

  it("fails a run that ran no test, as when its browser page can't open, with that reason alone", () => {
    const findings = FailureScreenshotCheck.findingsOf(noTest, []);

    assert.deepEqual(findings.map(t => t.split(":")[0]), ["The fixture's run should fail its one test, but ran no test, as when its browser page can't open"]);
  });

  it("runs the fixture once more when its run ran no test, and passes when that run fails its test as it should", async () => {
    const [passed, runs, written] = await runAsync([noTest, failed(logLine)]);

    assert.deepEqual([passed, runs], [true, 2]);
    assert.match(written, /^The fixture's run ran no test, so it runs once more:/u);
  });

  it("runs the fixture only once when its run ran its test, and fails when the second run also ran no test", async () => {
    const once = await runAsync([failed(logLine), noTest]);
    const twice = await runAsync([noTest, noTest, failed(logLine)]);

    assert.deepEqual([once[0], once[1], twice[0], twice[1]], [true, 1, false, 2]);
    assert.match(twice[2], /^The fixture's run should fail its one test, but ran no test/mu);
  });

  it("fails a run that didn't log the long name, logged a name that fits, or logged another file's path", () => {
    for (const output of ["", `Screenshot of "short.png": ${path.join(folder, shortName)}`, `Screenshot of "${longName}": ${path.join(folder, "other.png")}`]) {
      const findings = FailureScreenshotCheck.findingsOf(failed(output), [shortName]);

      assert.deepEqual(findings.map(t => t.split(":")[0]), [`The run should print "Screenshot of" the test's name, past 255 bytes, beside the saved screenshot's path`], output);
    }
  });
});
