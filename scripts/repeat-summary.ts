/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import RepeatUiOutcome from "./workflows/repeat-ui-outcome.ts";

export default class RepeatSummary {
  private static readonly REPORT_SEGMENTS: readonly string[] = ["_build", "ui", "report.json"];
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly LEG_VARIABLE: string = "REPEAT_LEG";
  private static readonly SETTINGS_REQUIRED: string = "GITHUB_STEP_SUMMARY and REPEAT_LEG must name the step summary file and the repeat job.\n";

  private readonly root: string;
  private readonly output: Writable;

  public constructor(root: string, output: Writable) {
    this.root = root;
    this.output = output;
  }

  public async runAsync(environment: NodeJS.ProcessEnv): Promise<number> {
    const summaryPath = environment[RepeatSummary.SUMMARY_VARIABLE];
    const leg = environment[RepeatSummary.LEG_VARIABLE];
    if (summaryPath === undefined || summaryPath.length === 0 || leg === undefined || leg.length === 0) {
      this.output.write(RepeatSummary.SETTINGS_REQUIRED);
      return 1;
    }

    const reportPath = path.join(this.root, ...RepeatSummary.REPORT_SEGMENTS);
    if (!existsSync(reportPath)) {
      const summary = `### Repeat (${leg})\n\nThe UI workflows left no report, so they stopped before Playwright ran them; the job's log has the details.\n`;
      await appendFile(summaryPath, summary);
      this.output.write(summary);
      return 0;
    }
    const outcome = RepeatUiOutcome.parse(await readFile(reportPath, "utf8"));
    const summary = outcome.formatSummary(leg);
    await appendFile(summaryPath, summary);
    this.output.write(`${summary}${outcome.formatAnnotation(leg)}`);
    return 0;
  }
}

if (import.meta.main)
  process.exitCode = await new RepeatSummary(process.cwd(), process.stdout).runAsync(process.env);
