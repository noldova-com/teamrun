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

import JsonFields from "./totals/json-fields.ts";
import RunnerTotals from "./totals/runner-totals.ts";
import TotalsCombiner from "./totals/totals-combiner.ts";
import TotalsException from "./totals/totals.exception.ts";

export default class RunTotals {
  private static readonly FOLDER_SEGMENTS: readonly string[] = ["_build", "run-totals"];
  private static readonly RUNNERS: readonly string[] = ["package", "script", "angular", "ui"];
  private static readonly UI_RUNNER: string = "ui";
  private static readonly WHOLE_PART: string = "all";
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly TARGETS_VARIABLE: string = "TARGETS";
  private static readonly RUN_UI_VARIABLE: string = "RUN_UI";
  private static readonly VALIDATION_VARIABLE: string = "VALIDATION_RESULT";
  private static readonly SUCCESS: string = "success";
  private static readonly TRUE: string = "true";
  private static readonly ENCODING: BufferEncoding = "utf8";
  private static readonly TARGETS_SOURCE: string = "The targets plan";
  private static readonly HEADING: string = "### Test totals\n\n";
  private static readonly NO_TOTALS: string = "No totals were recorded.\n";
  private static readonly PROBLEMS: string = "The run's totals have these problems:";
  private static readonly UNCHECKED: string = "A job of the run didn't pass, so these don't fail the totals:";
  private static readonly SETTINGS_REQUIRED: string = "GITHUB_STEP_SUMMARY and TARGETS must name the step summary file and the classification's targets.\n";

  private readonly root: string;
  private readonly output: Writable;

  public constructor(root: string, output: Writable) {
    this.root = root;
    this.output = output;
  }

  public async runAsync(environment: NodeJS.ProcessEnv): Promise<number> {
    const summaryPath = environment[RunTotals.SUMMARY_VARIABLE];
    const targets = environment[RunTotals.TARGETS_VARIABLE];
    if (summaryPath === undefined || summaryPath.length === 0 || targets === undefined || targets.length === 0) {
      this.output.write(RunTotals.SETTINGS_REQUIRED);
      return 1;
    }

    const isComplete = environment[RunTotals.VALIDATION_VARIABLE] === RunTotals.SUCCESS;
    const runsUi = environment[RunTotals.RUN_UI_VARIABLE] === RunTotals.TRUE;
    try {
      const problems: string[] = [];
      const sections: string[] = [];
      const runners: RunnerTotals[] = [];
      for (const target of JsonFields.parse(`{"targets":${targets}}`, RunTotals.TARGETS_SOURCE).objects("targets")) {
        const totals = await this.readTargetAsync(target, runsUi, problems);
        runners.push(...totals);
        sections.push(`#### ${target.text("target")}\n\n${RunTotals.formatTable(totals)}`);
      }
      const whole = RunTotals.groupByRunner(runners).map(t => TotalsCombiner.sum(t));
      sections.push(`#### Whole run\n\n${RunTotals.formatTable(whole)}`);
      const summary = `${RunTotals.HEADING}${sections.join("\n")}${RunTotals.formatProblems(problems, isComplete)}`;
      await appendFile(summaryPath, summary);
      this.output.write(summary);
      return isComplete && problems.length > 0 ? 1 : 0;
    }
    catch (error) {
      if (!(error instanceof TotalsException))
        throw error;
      await appendFile(summaryPath, `${RunTotals.HEADING}${error.message}\n`);
      this.output.write(`${error.message}\n`);
      return 1;
    }
  }

  private async readTargetAsync(target: JsonFields, runsUi: boolean, problems: string[]): Promise<readonly RunnerTotals[]> {
    const name = target.text("target");
    const prefix = `${target.text("runner")}-${target.text("architecture")}`;
    const jobs = target.objects("jobs").map(t => `totals-${prefix}-${t.text("part") || RunTotals.WHOLE_PART}`);
    const shards = runsUi && target.has("ui") ? target.object("ui").objects("shards").map(t => `totals-ui-${prefix}-${t.count("shard")}`) : [];
    const records: RunnerTotals[] = [];
    for (const artifact of [...jobs, ...shards]) {
      const folder = path.join(this.root, ...RunTotals.FOLDER_SEGMENTS, artifact);
      if (!existsSync(folder))
        problems.push(`${name}: ${artifact} left no totals record.`);
      else
        for (const file of (await readdir(folder)).sort())
          records.push(RunnerTotals.parse(await readFile(path.join(folder, file), RunTotals.ENCODING), `${artifact}/${file}`));
    }
    return RunTotals.groupByRunner(records).flatMap(t => {
      if (t[0].runner !== RunTotals.UI_RUNNER)
        return t;
      const combined = TotalsCombiner.combineShards(t);
      problems.push(...[
        TotalsCombiner.findDisagreement(t),
        RunTotals.formatList(`The shards of ${combined.title} ran no test in these files:`, combined.missing),
        RunTotals.formatList(`${combined.title} found no tests in these files:`, combined.empty)
      ].filter(u => u !== null).map(u => `${name}: ${u}`));
      return [combined];
    });
  }

  private static groupByRunner(totals: readonly RunnerTotals[]): readonly (readonly [RunnerTotals, ...RunnerTotals[]])[] {
    return RunTotals.RUNNERS.map(t => totals.filter(u => u.runner === t)).filter((t): t is [RunnerTotals, ...RunnerTotals[]] => t.length > 0);
  }

  private static formatTable(totals: readonly RunnerTotals[]): string {
    return totals.length === 0 ? RunTotals.NO_TOTALS : RunnerTotals.formatTable(totals);
  }

  private static formatProblems(problems: readonly string[], isComplete: boolean): string {
    return problems.length === 0 ? "" : `\n${isComplete ? RunTotals.PROBLEMS : RunTotals.UNCHECKED}\n\n${problems.map(t => `- ${t}\n`).join("")}`;
  }

  private static formatList(heading: string, items: readonly string[]): string | null {
    return items.length === 0 ? null : `${heading}${items.map(t => `\n  ${t}`).join("")}`;
  }
}

if (import.meta.main)
  process.exitCode = await new RunTotals(process.cwd(), process.stdout).runAsync(process.env);
