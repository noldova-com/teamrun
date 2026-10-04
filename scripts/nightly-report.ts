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

import ProcessRunner from "./processes/process-runner.ts";
import GitHubApi from "./repository/github-api.ts";
import NightlyFailure from "./workflows/nightly-failure.ts";
import NightlyFilingException from "./workflows/nightly-filing.exception.ts";
import NightlyFinding from "./workflows/nightly-finding.ts";
import NightlyIssueFiler from "./workflows/nightly-issue-filer.ts";
import NightlyLegResult from "./workflows/nightly-leg-result.ts";

export default class NightlyReport {
  private static readonly REPOSITORY_VARIABLE: string = "GITHUB_REPOSITORY";
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly RUN_VARIABLE: string = "NIGHTLY_RUN_URL";
  private static readonly LEGS_VARIABLE: string = "NIGHTLY_LEGS";
  private static readonly RESULTS_VARIABLE: string = "NIGHTLY_RESULTS";
  private static readonly RESULT_EXTENSION: string = ".json";
  private static readonly WHOLE_RUN: string = " › the run itself";
  private static readonly NO_RESULT: string = "It left no result, so it didn't start or stopped before recording one.";
  private static readonly HEADING: string = "Nightly repeats:\n\n";
  private static readonly PASSED: string = "- Every job passed.";
  private static readonly VARIABLES_REQUIRED: string = "GITHUB_REPOSITORY, GITHUB_STEP_SUMMARY, NIGHTLY_RUN_URL, NIGHTLY_LEGS (a JSON list of the jobs' labels) and NIGHTLY_RESULTS must describe the run.\n";

  private readonly runner: ProcessRunner;
  private readonly output: Writable;
  private readonly directory: string;

  public constructor(runner: ProcessRunner, output: Writable, directory: string) {
    this.runner = runner;
    this.output = output;
    this.directory = directory;
  }

  public async runAsync(environment: NodeJS.ProcessEnv): Promise<number> {
    const read = (name: string): string => environment[name] ?? "";
    const [repository, summaryPath, runUrl, results] = [read(NightlyReport.REPOSITORY_VARIABLE), read(NightlyReport.SUMMARY_VARIABLE), read(NightlyReport.RUN_VARIABLE), read(NightlyReport.RESULTS_VARIABLE)];
    const legs = NightlyReport.readLegs(read(NightlyReport.LEGS_VARIABLE));
    if ([repository, summaryPath, runUrl, results].some(t => t.length === 0) || legs === null) {
      this.output.write(NightlyReport.VARIABLES_REQUIRED);
      return 1;
    }

    const findings = NightlyReport.collect(legs, await NightlyReport.readResultsAsync(path.resolve(this.directory, results)));
    if (findings.length === 0)
      return await this.summarizeAsync(summaryPath, [NightlyReport.PASSED], 0);
    try {
      return await this.summarizeAsync(summaryPath, await new NightlyIssueFiler(new GitHubApi(repository, this.runner, this.directory), repository, runUrl).fileAsync(findings), 0);
    }
    catch (error) {
      if (!(error instanceof NightlyFilingException))
        throw error;
      return await this.summarizeAsync(summaryPath, [...error.filed, `- ${error.message}`], 1);
    }
  }

  private async summarizeAsync(summaryPath: string, lines: readonly string[], exitCode: number): Promise<number> {
    const summary = `${NightlyReport.HEADING}${lines.join("\n")}\n`;
    await appendFile(summaryPath, summary);
    this.output.write(summary);
    return exitCode;
  }

  private static readLegs(text: string): readonly string[] | null {
    try {
      const legs: unknown = JSON.parse(text);
      return Array.isArray(legs) && legs.length > 0 && legs.every(t => typeof t === "string" && t.length > 0) ? legs : null;
    }
    catch {
      return null;
    }
  }

  private static async readResultsAsync(folder: string): Promise<readonly NightlyLegResult[]> {
    if (!existsSync(folder))
      return [];
    const names = (await readdir(folder)).filter(t => t.endsWith(NightlyReport.RESULT_EXTENSION)).sort();
    return await Promise.all(names.map(async t => NightlyLegResult.parse(await readFile(path.join(folder, t), "utf8"), t)));
  }

  private static collect(legs: readonly string[], results: readonly NightlyLegResult[]): readonly NightlyFinding[] {
    const findings = new Map<string, NightlyFinding>();
    const add = (failure: NightlyFailure, label: string): void => {
      const known = findings.get(failure.name);
      findings.set(failure.name, known === undefined ? new NightlyFinding(failure, [label])
        : new NightlyFinding(new NightlyFailure(failure.name, known.failure.message, known.failure.count + failure.count), [...known.labels, label]));
    };
    for (const result of results)
      for (const failure of result.failures)
        add(failure, result.label);
    for (const label of legs.filter(t => !results.some(result => result.label === t)))
      add(new NightlyFailure(`${label}${NightlyReport.WHOLE_RUN}`, NightlyReport.NO_RESULT, 1), label);
    return [...findings.values()].sort((first, second) => first.failure.name.localeCompare(second.failure.name));
  }
}

if (import.meta.main)
  process.exitCode = await new NightlyReport(new ProcessRunner(), process.stdout, process.cwd()).runAsync(process.env);
