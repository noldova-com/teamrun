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
import Git from "./repository/git.ts";
import RepositoryFiles from "./repository/repository-files.ts";
import RepeatMatrix from "./workflows/repeat-matrix.ts";
import type RepeatSelection from "./workflows/repeat-selection.ts";
import RepeatSelector from "./workflows/repeat-selector.ts";
import RepeatException from "./workflows/repeat.exception.ts";

export default class RepeatPlan {
  private static readonly OUTPUT_VARIABLE: string = "GITHUB_OUTPUT";
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly BASE_VARIABLE: string = "BASE_SHA";
  private static readonly HEAD_VARIABLE: string = "HEAD_SHA";
  private static readonly BODY_VARIABLE: string = "PR_BODY";
  private static readonly REVISION_PATTERN: RegExp = /^[0-9a-f]{40}$/;
  private static readonly REPEAT_LINE: RegExp = /^Repeat:(.*)$/gm;
  private static readonly NAME_SEPARATOR: RegExp = /[\s,]+/;
  private static readonly WHITESPACE: RegExp = /\s/;
  private static readonly OUTPUTS_REQUIRED: string = "GITHUB_OUTPUT and GITHUB_STEP_SUMMARY must name the step's output and summary files.\n";
  private static readonly REVISIONS_REQUIRED: string = "BASE_SHA and HEAD_SHA must name the pull request's base and head commits.\n";

  private readonly git: Git;
  private readonly selector: RepeatSelector;
  private readonly output: Writable;

  public constructor(git: Git, selector: RepeatSelector, output: Writable) {
    this.git = git;
    this.selector = selector;
    this.output = output;
  }

  public async runAsync(environment: NodeJS.ProcessEnv): Promise<number> {
    const outputPath = environment[RepeatPlan.OUTPUT_VARIABLE];
    const summaryPath = environment[RepeatPlan.SUMMARY_VARIABLE];
    if (outputPath === undefined || outputPath.length === 0 || summaryPath === undefined || summaryPath.length === 0) {
      this.output.write(RepeatPlan.OUTPUTS_REQUIRED);
      return 1;
    }
    const base = environment[RepeatPlan.BASE_VARIABLE] ?? "";
    const head = environment[RepeatPlan.HEAD_VARIABLE] ?? "";
    if (!await this.existsAsync(base) || !await this.existsAsync(head)) {
      this.output.write(RepeatPlan.REVISIONS_REQUIRED);
      return 1;
    }

    const mergeBase = (await this.git.readOutputAsync(["merge-base", base, head])).trim();
    const changed = (await this.git.readOutputAsync(["diff", "--no-renames", "--name-only", "-z", mergeBase, head, "--"])).split("\0").filter(t => t.length > 0);
    const named = [...(environment[RepeatPlan.BODY_VARIABLE] ?? "").matchAll(RepeatPlan.REPEAT_LINE)]
      .flatMap(t => t.slice(1).flatMap(u => u.split(RepeatPlan.NAME_SEPARATOR))).filter(t => t.length > 0);
    let selection: RepeatSelection;
    try {
      selection = await this.selector.selectAsync(changed, named);
    }
    catch (error) {
      if (!(error instanceof RepeatException))
        throw error;
      this.output.write(`${error.message}\n`);
      return 1;
    }
    const spaced = [...selection.tests, ...selection.workflows].filter(t => RepeatPlan.WHITESPACE.test(t));
    if (spaced.length > 0) {
      this.output.write(`The repeats pass file paths as words, so a path with whitespace can't be repeated: ${spaced.join(", ")}.\n`);
      return 1;
    }

    const legs = selection.isEmpty ? [] : RepeatMatrix.plan(selection.workflowTests);
    await appendFile(outputPath, `legs=${JSON.stringify(legs)}\ntest-arguments=${selection.testArguments.join(" ")}\nworkflow-arguments=${selection.workflows.join(" ")}\n`);
    await appendFile(summaryPath, `${selection.summary}\n`);
    this.output.write(`${selection.summary}\n`);
    return 0;
  }

  private async existsAsync(revision: string): Promise<boolean> {
    return RepeatPlan.REVISION_PATTERN.test(revision) && await this.git.succeedsAsync(["cat-file", "-e", `${revision}^{commit}`]);
  }
}

if (import.meta.main) {
  const git = new Git(process.cwd(), new ProcessRunner());
  process.exitCode = await new RepeatPlan(git, new RepeatSelector(process.cwd(), new RepositoryFiles(process.cwd(), git)), process.stdout).runAsync(process.env);
}
