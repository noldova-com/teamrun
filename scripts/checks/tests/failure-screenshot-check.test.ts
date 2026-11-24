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
const netstatText = ["", "Active Connections", "", "  Proto  Local Address          Foreign Address        State",
  "  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING", "  TCP    127.0.0.1:24315        127.0.0.1:50001        TIME_WAIT",
  "  TCP    127.0.0.1:50002        127.0.0.1:24315        TIME_WAIT", "  TCP    127.0.0.1:50003        127.0.0.1:24315        ESTABLISHED",
  "  TCP    [::1]:24315            [::1]:50004            TIME_WAIT", "  UDP    0.0.0.0:5353           *:*                    ", ""].join("\r\n");
const sockets = new ProcessResult(0, netstatText, "");

class CheckRun {
  public readonly passed: boolean;
  public readonly runs: number;
  public readonly written: string;
  public readonly netstatRuns: number;

  public constructor(passed: boolean, runs: number, written: string, netstatRuns: number) {
    this.passed = passed;
    this.runs = runs;
    this.written = written;
    this.netstatRuns = netstatRuns;
  }
}

class ScriptedRunner extends ProcessRunner {
  public runs: number = 0;
  public netstatRuns: number = 0;
  private readonly results: readonly ProcessResult[];
  private readonly netstat: ProcessResult | Error;

  public constructor(results: readonly ProcessResult[], netstat: ProcessResult | Error) {
    super();
    this.results = results;
    this.netstat = netstat;
  }

  public override async captureAsync(command: string, _commandArguments: readonly string[], _directory: string, _timeout: number,
    environment?: NodeJS.ProcessEnv): Promise<ProcessResult> {
    if (command === "netstat") {
      this.netstatRuns++;
      if (this.netstat instanceof Error)
        throw this.netstat;
      return this.netstat;
    }
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

const runAsync = async (results: readonly ProcessResult[], platform: string = "linux", netstat: ProcessResult | Error = sockets):
  Promise<CheckRun> => {
  const root = await mkdtemp(path.join(tmpdir(), "failure-screenshot-check-"));
  try {
    const runner = new ScriptedRunner(results, netstat);
    let written = "";
    const output = new Writable({
      write: (chunk: Buffer, _encoding, done): void => {
        written += chunk.toString();
        done();
      }
    });
    const passed = await new FailureScreenshotCheck(root, runner, platform).runAsync(output);
    return new CheckRun(passed, runner.runs, written, runner.netstatRuns);
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

  it("runs the fixture once and fails a run that ran no test with that reason, and passes a run that failed its test as it should", async () => {
    const none = await runAsync([noTest, failed(logLine)]);
    const ran = await runAsync([failed(logLine)]);

    assert.deepEqual([none.passed, none.runs, ran.passed, ran.runs], [false, 1, true, 1]);
    assert.match(none.written, /^The fixture's run should fail its one test, but ran no test, as when its browser page can't open:/u);
  });

  it("counts netstat's TCP connections by state, most first, over IPv4 and IPv6, and says none when it lists none", () => {
    assert.deepEqual([FailureScreenshotCheck.socketStatesOf(netstatText), FailureScreenshotCheck.socketStatesOf("Active Connections\r\n")],
      ["TIME_WAIT 3, ESTABLISHED 1, LISTENING 1", "none"]);
  });

  it("prints Windows' TCP connections by state after a run that ran no test, and asks netstat only then and only on Windows", async () => {
    const windows = await runAsync([noTest], "win32");
    const ran = await runAsync([failed(logLine)], "win32");
    const linux = await runAsync([noTest], "linux");

    assert.deepEqual([windows.passed, windows.netstatRuns, ran.passed, ran.netstatRuns, linux.passed, linux.netstatRuns], [false, 1, true, 0, false, 0]);
    assert.match(windows.written, /^Windows' TCP connections by state after that run, from netstat: TIME_WAIT 3, ESTABLISHED 1, LISTENING 1\.$/mu);
    assert.doesNotMatch(`${ran.written}${linux.written}`, /netstat/u);
  });

  it("still fails a run that ran no test for that reason when netstat exits with an error or can't start, and says which", async () => {
    const exited = await runAsync([noTest], "win32", new ProcessResult(1, "", "The requested operation requires elevation."));
    const failedToStart = await runAsync([noTest], "win32", new Error(`"netstat" could not start.`));

    assert.deepEqual([exited.passed, failedToStart.passed], [false, false]);
    assert.match(exited.written, /^netstat couldn't list Windows' TCP connections after that run, and exited with 1:\nThe requested operation requires elevation\.$/mu);
    assert.match(failedToStart.written, /^netstat couldn't list Windows' TCP connections after that run: "netstat" could not start\.$/mu);
    assert.match(failedToStart.written, /^The fixture's run should fail its one test, but ran no test/u);
  });

  it("fails a run that didn't log the long name, logged a name that fits, or logged another file's path", () => {
    for (const output of ["", `Screenshot of "short.png": ${path.join(folder, shortName)}`, `Screenshot of "${longName}": ${path.join(folder, "other.png")}`]) {
      const findings = FailureScreenshotCheck.findingsOf(failed(output), [shortName]);

      assert.deepEqual(findings.map(t => t.split(":")[0]), [`The run should print "Screenshot of" the test's name, past 255 bytes, beside the saved screenshot's path`], output);
    }
  });
});
