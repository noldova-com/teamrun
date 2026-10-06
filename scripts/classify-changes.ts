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
import BuildMatrix from "./workflows/build-matrix.ts";
import type BuildTarget from "./workflows/build-target.ts";
import ChangeClassifier from "./workflows/change-classifier.ts";
import TestJobPlan from "./workflows/test-job-plan.ts";

export default class ClassifyChanges {
  private static readonly OUTPUT_VARIABLE: string = "GITHUB_OUTPUT";
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly EVENT_VARIABLE: string = "EVENT_NAME";
  private static readonly BASE_VARIABLE: string = "BASE_SHA";
  private static readonly HEAD_VARIABLE: string = "HEAD_SHA";
  private static readonly TARGET_SEPARATOR: string = ", ";
  private static readonly CELL_SEPARATOR: string = "|";
  private static readonly ROW_SEPARATOR: string = ";";
  private static readonly KEY_SEPARATOR: string = " ";
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

    const eventName = environment[ClassifyChanges.EVENT_VARIABLE];
    const scope = await this.classifier.classifyAsync(eventName, environment[ClassifyChanges.BASE_VARIABLE], environment[ClassifyChanges.HEAD_VARIABLE]);
    const matrix = new BuildMatrix(eventName);
    const targets = JSON.stringify(matrix.targets.map(t => ({ ...ClassifyChanges.describe(t), jobs: TestJobPlan.plan(t) })));
    const table = matrix.targets.map(t => [t.name, t.runner, t.operatingSystem, t.architecture].join(ClassifyChanges.CELL_SEPARATOR)).join(ClassifyChanges.ROW_SEPARATOR);
    const uiTargets = matrix.uiTargets.map(t => t.key).join(ClassifyChanges.KEY_SEPARATOR);
    const uiPlan = JSON.stringify(Object.fromEntries(matrix.uiTargets.map(t => {
      const shards = matrix.uiShards(t);
      return [t.key, {
        build: shards.some(s => s.isPrebuilt) ? [ClassifyChanges.describe(t)] : [],
        shards: shards.map(s => ({ ...ClassifyChanges.describe(t), shard: s.index, shards: s.count, grep: s.grep, prebuilt: s.isPrebuilt }))
      }];
    })));
    const deferred = matrix.deferred.map(t => t.name).join(ClassifyChanges.TARGET_SEPARATOR);
    const uiDeferred = matrix.uiDeferred.map(t => t.name).join(ClassifyChanges.TARGET_SEPARATOR);
    await appendFile(outputPath,
      `run-code=${scope.runCode}\nrun-ui=${scope.runUi}\ntargets=${targets}\ntarget-table=${table}\nui-targets=${uiTargets}\nui-plan=${uiPlan}\ndeferred=${deferred}\nui-deferred=${uiDeferred}\n`);
    await appendFile(summaryPath, `${scope.summary}\n`);
    this.output.write(`${scope.summary}\n`);
    return 0;
  }

  private static describe(target: BuildTarget): object {
    return { target: target.name, runner: target.runner, architecture: target.architecture };
  }
}

if (import.meta.main)
  process.exitCode = await new ClassifyChanges(new ChangeClassifier(new Git(process.cwd(), new ProcessRunner())), process.stdout).runAsync(process.env);
