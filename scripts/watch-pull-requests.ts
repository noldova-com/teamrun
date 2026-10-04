/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFile } from "node:fs/promises";
import type { Writable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";

import ProcessRunner from "./processes/process-runner.ts";
import Git from "./repository/git.ts";
import GitHubApi from "./repository/github-api.ts";
import MergeConflictReader from "./workflows/merge-conflict.reader.ts";
import PullRequestEvaluator from "./workflows/pull-request-evaluator.ts";
import PullRequestWatcher from "./workflows/pull-request-watcher.ts";
import PullRequestReader from "./workflows/pull-request.reader.ts";

export default class WatchPullRequests {
  private static readonly REPOSITORY_VARIABLE: string = "GITHUB_REPOSITORY";
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly VARIABLES_REQUIRED: string = "GITHUB_REPOSITORY and GITHUB_STEP_SUMMARY must name the repository and the step's summary file.\n";
  private static readonly HEADING: string = "Open pull requests:\n\n";

  private readonly runner: ProcessRunner;
  private readonly output: Writable;
  private readonly directory: string;
  private readonly clock: () => number;
  private readonly wait: (milliseconds: number) => Promise<void>;

  public constructor(runner: ProcessRunner, output: Writable, directory: string, clock: () => number, wait: (milliseconds: number) => Promise<void>) {
    this.runner = runner;
    this.output = output;
    this.directory = directory;
    this.clock = clock;
    this.wait = wait;
  }

  public async runAsync(environment: NodeJS.ProcessEnv): Promise<number> {
    const repository = environment[WatchPullRequests.REPOSITORY_VARIABLE];
    const summaryPath = environment[WatchPullRequests.SUMMARY_VARIABLE];
    if (repository === undefined || repository.length === 0 || summaryPath === undefined || summaryPath.length === 0) {
      this.output.write(WatchPullRequests.VARIABLES_REQUIRED);
      return 1;
    }

    const api = new GitHubApi(repository, this.runner, this.directory);
    const conflicts = new MergeConflictReader(new Git(this.directory, this.runner));
    const watcher = new PullRequestWatcher(api, new PullRequestReader(api), new PullRequestEvaluator(), conflicts, this.clock, this.wait);
    const summary = `${WatchPullRequests.HEADING}${(await watcher.watchAsync()).join("\n")}\n`;
    await appendFile(summaryPath, summary);
    this.output.write(summary);
    return 0;
  }
}

if (import.meta.main)
  process.exitCode = await new WatchPullRequests(new ProcessRunner(), process.stdout, process.cwd(), Date.now, delay).runAsync(process.env);
