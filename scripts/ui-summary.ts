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

import UiReport from "./workflows/ui-report.ts";
import UiReportException from "./workflows/ui-report.exception.ts";

export default class UiSummary {
  private static readonly REPORT_SEGMENTS: readonly string[] = ["_build", "ui", "report.json"];
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly TARGET_VARIABLE: string = "UI_TARGET";
  private static readonly SCREENSHOT_VARIABLE: string = "SCREENSHOT_URL";
  private static readonly SETTINGS_REQUIRED: string = "GITHUB_STEP_SUMMARY and UI_TARGET must name the step summary file and the target.\n";
  private static readonly NO_REPORT: string = "The UI workflows produced no report.";

  private readonly root: string;
  private readonly output: Writable;

  public constructor(root: string, output: Writable) {
    this.root = root;
    this.output = output;
  }

  public async runAsync(environment: NodeJS.ProcessEnv): Promise<number> {
    const summaryPath = environment[UiSummary.SUMMARY_VARIABLE];
    const target = environment[UiSummary.TARGET_VARIABLE];
    if (summaryPath === undefined || summaryPath.length === 0 || target === undefined || target.length === 0) {
      this.output.write(UiSummary.SETTINGS_REQUIRED);
      return 1;
    }

    const reportPath = path.join(this.root, ...UiSummary.REPORT_SEGMENTS);
    if (!existsSync(reportPath))
      return await this.failAsync(summaryPath, target, UiSummary.NO_REPORT);
    try {
      const summary = UiReport.parse(await readFile(reportPath, "utf8")).formatSummary(target, environment[UiSummary.SCREENSHOT_VARIABLE]);
      await appendFile(summaryPath, summary);
      this.output.write(summary);
      return 0;
    }
    catch (error) {
      if (!(error instanceof UiReportException))
        throw error;
      return await this.failAsync(summaryPath, target, error.message);
    }
  }

  private async failAsync(summaryPath: string, target: string, message: string): Promise<number> {
    await appendFile(summaryPath, `### UI workflows: ${target}\n\n${message}\n`);
    this.output.write(`${message}\n`);
    return 1;
  }
}

if (import.meta.main)
  process.exitCode = await new UiSummary(process.cwd(), process.stdout).runAsync(process.env);
