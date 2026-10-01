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
import ChangeClassifier from "./workflows/change-classifier.ts";

export default class ClassifyChanges {
  private static readonly OUTPUT_VARIABLE: string = "GITHUB_OUTPUT";
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly EVENT_VARIABLE: string = "EVENT_NAME";
  private static readonly BASE_VARIABLE: string = "BASE_SHA";
  private static readonly HEAD_VARIABLE: string = "HEAD_SHA";
  private static readonly OUTPUTS_REQUIRED: string = "GITHUB_OUTPUT and GITHUB_STEP_SUMMARY must name the step's output and summary files.\n";

  private readonly classifier: ChangeClassifier;
  private readonly output: Writable;

  public constructor(classifier: ChangeClassifier, output: Writable) {
    this.classifier = classifier;
    this.output = output;
  }

  public async runAsync(environment: NodeJS.ProcessEnv): Promise<number> {
    const outputPath = environment[ClassifyChanges.OUTPUT_VARIABLE];
    const summaryPath = environment[ClassifyChanges.SUMMARY_VARIABLE];
    if (outputPath === undefined || outputPath.length === 0 || summaryPath === undefined || summaryPath.length === 0) {
      this.output.write(ClassifyChanges.OUTPUTS_REQUIRED);
      return 1;
    }

    const scope = await this.classifier.classifyAsync(
      environment[ClassifyChanges.EVENT_VARIABLE],
      environment[ClassifyChanges.BASE_VARIABLE],
      environment[ClassifyChanges.HEAD_VARIABLE]);
    await appendFile(outputPath, `run-code=${scope.runCode}\n`);
    await appendFile(summaryPath, `${scope.summary}\n`);
    this.output.write(`${scope.summary}\n`);
    return 0;
  }
}

if (import.meta.main)
  process.exitCode = await new ClassifyChanges(new ChangeClassifier(new Git(process.cwd(), new ProcessRunner())), process.stdout).runAsync(process.env);
