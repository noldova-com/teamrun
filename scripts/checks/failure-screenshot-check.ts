/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";
import { stripVTControlCharacters } from "node:util";

import { ShortScreenshotNames } from "../angular/short-screenshot-names.ts";
import type { ProcessResult } from "../processes/process-result.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class FailureScreenshotCheck implements ICheck {
  private static readonly CLI: string = "node_modules/vitest/vitest.mjs";
  private static readonly FIXTURE: string = "src/noldova.teamrun.window/tests/fixtures/failure-screenshot";
  private static readonly RUN_ARGUMENTS: readonly string[] = ["run", "--config", "vitest.config.mts"];
  private static readonly ATTACHMENTS_VARIABLE: string = "NOLDOVA_FAILURE_SCREENSHOT_ATTACHMENTS";
  private static readonly ATTACHMENTS_SEGMENTS: readonly string[] = ["_build", "failure-screenshot-check"];
  private static readonly SCREENSHOTS_FOLDER: string = "failure-screenshots";
  private static readonly TIMEOUT: number = 300_000;
  private static readonly FAILED_RUN: number = 1;
  private static readonly SHORT_NAME: RegExp = /^fails-with-a-title-past-what-a-file-name-may-hold[\w -]*-[\da-f]{16}\.png$/u;
  private static readonly LOGGED: RegExp = /^Screenshot of "(?<name>[^"]+)": (?<path>.+)$/mu;
  private static readonly NO_TEST: RegExp = /^\s*Tests\s+no tests\s*$/mu;

  private readonly root: string;
  private readonly runner: ProcessRunner;

  public readonly title: string = "Failure screenshots";

  public constructor(root: string, runner: ProcessRunner) {
    this.root = root;
    this.runner = runner;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const run = await this.runFixtureAsync();
    const findings = FailureScreenshotCheck.findingsOf(run.result, run.files);
    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Ran ${FailureScreenshotCheck.FIXTURE} in Vitest's browser mode and found ${run.files.length} failure screenshot files.\n`);
    return findings.length === 0;
  }

  public static findingsOf(result: ProcessResult, files: readonly string[]): readonly string[] {
    if (result.exitCode !== FailureScreenshotCheck.FAILED_RUN)
      return [`The fixture's run should fail its one test and exit with ${FailureScreenshotCheck.FAILED_RUN}, but exited with ${result.exitCode}:\n${result.text}`];
    if (FailureScreenshotCheck.ranNoTest(result))
      return [`The fixture's run should fail its one test, but ran no test, as when its browser page can't open:\n${result.text}`];
    const logged = FailureScreenshotCheck.LOGGED.exec(result.text)?.groups;
    const file = files.length === 1 ? files[0] : undefined;
    const findings: string[] = [];
    if (file === undefined || !FailureScreenshotCheck.SHORT_NAME.test(file) || Buffer.byteLength(file) > ShortScreenshotNames.NAME_LIMIT)
      findings.push(`The failed test should leave one screenshot named with the start of its title and 16 hexadecimal digits, within ${ShortScreenshotNames.NAME_LIMIT} bytes, `
        + `but left ${JSON.stringify(files)}:\n${result.text}`);
    if (logged?.["name"] === undefined || Buffer.byteLength(logged["name"]) <= ShortScreenshotNames.NAME_LIMIT || path.basename(logged["path"] ?? "") !== file)
      findings.push(`The run should print "Screenshot of" the test's name, past ${ShortScreenshotNames.NAME_LIMIT} bytes, beside the saved screenshot's path:\n${result.text}`);
    return findings;
  }

  private static ranNoTest(result: ProcessResult): boolean {
    return FailureScreenshotCheck.NO_TEST.test(stripVTControlCharacters(result.text));
  }

  private async runFixtureAsync(): Promise<{ readonly result: ProcessResult; readonly files: readonly string[] }> {
    const attachments = path.join(this.root, ...FailureScreenshotCheck.ATTACHMENTS_SEGMENTS);
    await rm(attachments, { recursive: true, force: true });
    await mkdir(attachments, { recursive: true });
    try {
      const result = await this.runner.captureAsync(process.execPath, [path.join(this.root, FailureScreenshotCheck.CLI), ...FailureScreenshotCheck.RUN_ARGUMENTS],
        path.join(this.root, FailureScreenshotCheck.FIXTURE), FailureScreenshotCheck.TIMEOUT, { ...process.env, [FailureScreenshotCheck.ATTACHMENTS_VARIABLE]: attachments });
      const screenshots = path.join(attachments, FailureScreenshotCheck.SCREENSHOTS_FOLDER);
      const files = existsSync(screenshots) ? (await readdir(screenshots, { recursive: true, withFileTypes: true })).filter(t => t.isFile()).map(t => t.name) : [];
      return { result, files };
    }
    finally {
      await rm(attachments, { recursive: true, force: true });
    }
  }
}
