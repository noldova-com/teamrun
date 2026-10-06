/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFile } from "node:fs/promises";
import type { Writable } from "node:stream";

import PackageCatalog from "./packages/package-catalog.ts";
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
  private static readonly ON_PUSHES: string = "on every push to main and in manual runs";
  private static readonly EVERY_NIGHT: string = "every night and in manual runs";
  private static readonly CELL_SEPARATOR: string = "|";
  private static readonly ROW_SEPARATOR: string = ";";
  private static readonly KEY_SEPARATOR: string = " ";
  private static readonly NOT_APPLIED: string = "This run does not narrow its jobs to the selection yet.";
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
    const targets = JSON.stringify(matrix.targets.map(t => ({ ...ClassifyChanges.describe(t), jobs: TestJobPlan.plan(t), ui: ClassifyChanges.planUi(matrix, t) })));
    const table = BuildMatrix.TARGETS.map(t => [t.name, t.runner, t.operatingSystem, t.architecture].join(ClassifyChanges.CELL_SEPARATOR)).join(ClassifyChanges.ROW_SEPARATOR);
    const uiTargets = matrix.targets.map(t => t.key).join(ClassifyChanges.KEY_SEPARATOR);
    const deferred = matrix.deferred.map(t => `${t.name} (${t.runsOnPushes ? ClassifyChanges.ON_PUSHES : ClassifyChanges.EVERY_NIGHT})`).join(ClassifyChanges.TARGET_SEPARATOR);
    await appendFile(outputPath,
      `run-code=${scope.runCode}\nrun-ui=${scope.runUi}\ntargets=${targets}\ntarget-table=${table}\nui-targets=${uiTargets}\ndeferred=${deferred}\n`);
    const summary = `${scope.summary}\n${scope.selection.summary} ${ClassifyChanges.NOT_APPLIED}\n`;
    await appendFile(summaryPath, summary);
    this.output.write(summary);
    return 0;
  }

  private static planUi(matrix: BuildMatrix, target: BuildTarget): object {
    const shards = matrix.uiShards(target);
    const isShared = target.splitsTests && shards.some(t => t.isPrebuilt);
    return {
      shared: isShared,
      folded: matrix.foldsUi(target),
      build: !isShared && shards.some(t => t.isPrebuilt) ? [ClassifyChanges.describe(target)] : [],
      shards: shards.map(t => ({ ...ClassifyChanges.describe(target), shard: t.index, shards: t.count, grep: t.grep, prebuilt: t.isPrebuilt }))
    };
  }

  private static describe(target: BuildTarget): object {
    return { target: target.name, runner: target.runner, architecture: target.architecture };
  }
}

if (import.meta.main)
  process.exitCode = await new ClassifyChanges(new ChangeClassifier(new Git(process.cwd(), new ProcessRunner()), new PackageCatalog(process.cwd())), process.stdout).runAsync(process.env);
