/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { appendFile, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import FlakyRecordException from "./checks/flaky-record.exception.ts";
import FlakyRecord from "./checks/flaky-record.ts";
import ProcessRunner from "./processes/process-runner.ts";
import GitHubApi from "./repository/github-api.ts";
import FlakyFilingException from "./workflows/flaky-filing.exception.ts";
import FlakyIssueFiler from "./workflows/flaky-issue-filer.ts";
import FlakyOccurrence from "./workflows/flaky-occurrence.ts";
import FlakyRedactor from "./workflows/flaky-redactor.ts";

export default class FlakyReport {
  private static readonly REPOSITORY_VARIABLE: string = "GITHUB_REPOSITORY";
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly RUN_VARIABLE: string = "FLAKY_RUN_URL";
  private static readonly RECORDS_VARIABLE: string = "FLAKY_RECORDS";
  private static readonly RECORD_FILE: string = "flaky-tests.json";
  private static readonly ARTIFACT_PATTERN: RegExp = /^flaky-tests-(.+)-\d+$/;
  private static readonly UI_JOB_PATTERN: RegExp = /^ui-(.+)-(\d+)$/;
  private static readonly HEADING: string = "Flaky tests:\n\n";
  private static readonly NONE: string = "- No job recorded a flaky test.";
  private static readonly VARIABLES_REQUIRED: string = "GITHUB_REPOSITORY, GITHUB_STEP_SUMMARY, FLAKY_RUN_URL and FLAKY_RECORDS must describe the run.\n";

  private readonly runner: ProcessRunner;
  private readonly output: Writable;
  private readonly directory: string;
  private readonly now: Date;

  public constructor(runner: ProcessRunner, output: Writable, directory: string, now: Date) {
    this.runner = runner;
    this.output = output;
    this.directory = directory;
    this.now = now;
  }

  public static labelOf(artifact: string): string | null {
    const job = FlakyReport.ARTIFACT_PATTERN.exec(artifact)?.[1];
    if (job === undefined)
      return null;
    const ui = FlakyReport.UI_JOB_PATTERN.exec(job);
    return ui === null ? job : `${ui[1]}, UI shard ${ui[2]}`;
  }

  public async runAsync(environment: NodeJS.ProcessEnv): Promise<number> {
    const read = (name: string): string => environment[name] ?? "";
    const [repository, summaryPath, runUrl, records] = [read(FlakyReport.REPOSITORY_VARIABLE), read(FlakyReport.SUMMARY_VARIABLE), read(FlakyReport.RUN_VARIABLE), read(FlakyReport.RECORDS_VARIABLE)];
    if ([repository, summaryPath, runUrl, records].some(t => t.length === 0)) {
      this.output.write(FlakyReport.VARIABLES_REQUIRED);
      return 1;
    }

    let occurrences: readonly FlakyOccurrence[];
    try {
      occurrences = await FlakyReport.readAsync(path.resolve(this.directory, records));
    }
    catch (error) {
      if (!(error instanceof FlakyRecordException))
        throw error;
      return await this.summarizeAsync(summaryPath, [`- ${error.message}`], 1);
    }
    if (occurrences.length === 0)
      return await this.summarizeAsync(summaryPath, [FlakyReport.NONE], 0);
    const filer = new FlakyIssueFiler(new GitHubApi(repository, this.runner, this.directory), repository, runUrl, new FlakyRedactor(FlakyRedactor.RUNNER_HOMES), this.now);
    try {
      return await this.summarizeAsync(summaryPath, await filer.fileAsync(occurrences), 0);
    }
    catch (error) {
      if (!(error instanceof FlakyFilingException))
        throw error;
      return await this.summarizeAsync(summaryPath, [...error.filed, `- ${error.message}`], 1);
    }
  }

  private async summarizeAsync(summaryPath: string, lines: readonly string[], exitCode: number): Promise<number> {
    const summary = `${FlakyReport.HEADING}${lines.join("\n")}\n`;
    await appendFile(summaryPath, summary);
    this.output.write(summary);
    return exitCode;
  }

  private static async readAsync(folder: string): Promise<readonly FlakyOccurrence[]> {
    const occurrences = new Map<string, FlakyOccurrence>();
    const artifacts = existsSync(folder) ? (await readdir(folder)).sort() : [];
    for (const artifact of artifacts) {
      const label = FlakyReport.labelOf(artifact);
      const file = path.join(folder, artifact, FlakyReport.RECORD_FILE);
      if (label === null || !existsSync(file))
        continue;
      for (const test of FlakyRecord.parse(await readFile(file, "utf8"))) {
        const key = FlakyIssueFiler.keyOf(test);
        const known = occurrences.get(key);
        occurrences.set(key, new FlakyOccurrence(known?.test ?? test, [...known?.jobs ?? [], label]));
      }
    }
    return [...occurrences.values()].sort((first, second) => first.test.name.localeCompare(second.test.name));
  }
}

if (import.meta.main)
  process.exitCode = await new FlakyReport(new ProcessRunner(), process.stdout, process.cwd(), new Date()).runAsync(process.env);
