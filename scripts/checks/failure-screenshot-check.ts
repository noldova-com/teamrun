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

import type { AngularProject } from "../angular/angular-project.ts";
import { ShortScreenshotNames } from "../angular/short-screenshot-names.ts";
import { ProcessException } from "../processes/process.exception.ts";
import type { ProcessResult } from "../processes/process-result.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { FixtureRun } from "./fixture-run.ts";
import type { ICheck } from "./interfaces/i-check.ts";
import { SocketStateCount } from "./socket-state-count.ts";

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
  private static readonly WINDOWS_PLATFORM: string = "win32";
  private static readonly NETSTAT: string = "netstat";
  private static readonly NETSTAT_ARGUMENTS: readonly string[] = ["-an"];
  private static readonly NETSTAT_TIMEOUT: number = 30_000;
  private static readonly TCP_STATE: RegExp = /^\s*TCP\s+\S+\s+\S+\s+(?<state>[A-Z][A-Z_\d]*)\s*$/gmu;

  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly project: AngularProject;
  private readonly platform: string;

  public readonly title: string = "Failure screenshots";

  public constructor(root: string, runner: ProcessRunner, project: AngularProject, platform: string = process.platform) {
    this.root = root;
    this.runner = runner;
    this.project = project;
    this.platform = platform;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    try {
      await this.project.prepareAsync(output);
    }
    catch (error) {
      if (!(error instanceof ProcessException))
        throw error;
      output.write(`${error.message}\n`);
      return false;
    }
    const run = await this.runFixtureAsync();
    const findings = FailureScreenshotCheck.findingsOf(run.result, run.files);
    for (const finding of findings)
      output.write(`${finding}\n`);
    if (this.platform === FailureScreenshotCheck.WINDOWS_PLATFORM && findings.length > 0)
      output.write(`${await this.describeSocketsAsync()}\n`);
    output.write(`Ran ${FailureScreenshotCheck.FIXTURE} in Vitest's browser mode and found ${run.files.length} failure screenshot files.\n`);
    return findings.length === 0;
  }

  public static socketStatesOf(text: string): string {
    const counts = new Map<string, number>();
    for (const match of text.matchAll(FailureScreenshotCheck.TCP_STATE)) {
      const state = match.groups?.["state"] ?? "";
      counts.set(state, (counts.get(state) ?? 0) + 1);
    }
    const states = Array.from(counts.keys(), t => new SocketStateCount(t, counts.get(t) ?? 0))
      .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state));
    return states.length === 0 ? "none" : states.map(t => `${t.state} ${t.count}`).join(", ");
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

  private async describeSocketsAsync(): Promise<string> {
    try {
      const result = await this.runner.captureAsync(FailureScreenshotCheck.NETSTAT, FailureScreenshotCheck.NETSTAT_ARGUMENTS, this.root, FailureScreenshotCheck.NETSTAT_TIMEOUT);
      if (!result.isSuccessful)
        return `netstat couldn't list Windows' TCP connections after that run, and exited with ${result.exitCode}:\n${result.text}`;
      return `Windows' TCP connections by state after that run, from netstat: ${FailureScreenshotCheck.socketStatesOf(result.output)}.`;
    }
    catch (error) {
      return `netstat couldn't list Windows' TCP connections after that run: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async runFixtureAsync(): Promise<FixtureRun> {
    const attachments = path.join(this.root, ...FailureScreenshotCheck.ATTACHMENTS_SEGMENTS);
    await rm(attachments, { recursive: true, force: true });
    await mkdir(attachments, { recursive: true });
    try {
      const result = await this.runner.captureAsync(process.execPath, [path.join(this.root, FailureScreenshotCheck.CLI), ...FailureScreenshotCheck.RUN_ARGUMENTS],
        path.join(this.root, FailureScreenshotCheck.FIXTURE), FailureScreenshotCheck.TIMEOUT, { ...process.env, [FailureScreenshotCheck.ATTACHMENTS_VARIABLE]: attachments });
      const screenshots = path.join(attachments, FailureScreenshotCheck.SCREENSHOTS_FOLDER);
      const files = existsSync(screenshots) ? (await readdir(screenshots, { recursive: true, withFileTypes: true })).filter(t => t.isFile()).map(t => t.name) : [];
      return new FixtureRun(result, files);
    }
    finally {
      await rm(attachments, { recursive: true, force: true });
    }
  }
}
