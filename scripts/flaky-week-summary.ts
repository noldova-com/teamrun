/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFile } from "node:fs/promises";
import type { Writable } from "node:stream";

import ProcessRunner from "./processes/process-runner.ts";
import GitHubApi from "./repository/github-api.ts";
import GitHubException from "./repository/github.exception.ts";
import FlakyWeek from "./workflows/flaky-week.ts";

export default class FlakyWeekSummary {
  private static readonly REPOSITORY_VARIABLE: string = "GITHUB_REPOSITORY";
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly VARIABLES_REQUIRED: string = "GITHUB_REPOSITORY and GITHUB_STEP_SUMMARY must name the repository and the step summary file.\n";

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

  public async runAsync(environment: NodeJS.ProcessEnv): Promise<number> {
    const repository = environment[FlakyWeekSummary.REPOSITORY_VARIABLE] ?? "";
    const summaryPath = environment[FlakyWeekSummary.SUMMARY_VARIABLE] ?? "";
    if (repository.length === 0 || summaryPath.length === 0) {
      this.output.write(FlakyWeekSummary.VARIABLES_REQUIRED);
      return 1;
    }

    try {
      const summary = await new FlakyWeek(new GitHubApi(repository, this.runner, this.directory), this.now).summarizeAsync();
      await appendFile(summaryPath, summary);
      this.output.write(summary);
      return 0;
    }
    catch (error) {
      if (!(error instanceof GitHubException))
        throw error;
      this.output.write(`${error.message}\n`);
      return 1;
    }
  }
}

if (import.meta.main)
  process.exitCode = await new FlakyWeekSummary(new ProcessRunner(), process.stdout, process.cwd(), new Date()).runAsync(process.env);
