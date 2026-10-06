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

import FlakyRecord from "./checks/flaky-record.ts";
import ProcessRunner from "./processes/process-runner.ts";
import JsonFields from "./totals/json-fields.ts";
import TotalsException from "./totals/totals.exception.ts";
import UiWorkflows from "./ui-workflows.ts";
import UiReport from "./workflows/ui-report.ts";
import UiReportException from "./workflows/ui-report.exception.ts";
import UiTestReport from "./workflows/ui-test-report.ts";

export default class UiSummary {
  private static readonly REPORT_SEGMENTS: readonly string[] = ["_build", "ui", "report.json"];
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly TARGET_VARIABLE: string = "UI_TARGET";
  private static readonly SCREENSHOT_VARIABLE: string = "SCREENSHOT_URL";
  private static readonly UPLOAD_FAILED_VARIABLE: string = "SCREENSHOT_UPLOAD_FAILED";
  private static readonly GREP_VARIABLE: string = "GREP";
  private static readonly SHARD_VARIABLE: string = "UI_SHARD";
  private static readonly TRUE: string = "true";
  private static readonly SETTINGS_REQUIRED: string = "GITHUB_STEP_SUMMARY and UI_TARGET must name the step summary file and the target.\n";
  private static readonly NO_REPORT: string = "The UI workflows produced no report.";
  private static readonly NOT_LISTED: string = "Playwright could not list the UI workflows:";
  private static readonly REPORT_SOURCE: string = "_build/ui/report.json";
  private static readonly LIST_SOURCE: string = "The UI workflow list";
  private static readonly LIST_TIMEOUT: number = 120_000;
  private static readonly RUNNER: string = "ui";
  private static readonly TITLE: string = "UI workflows";

  private readonly root: string;
  private readonly output: Writable;
  private readonly runner: ProcessRunner;

  public constructor(root: string, output: Writable, runner: ProcessRunner) {
    this.root = root;
    this.output = output;
    this.runner = runner;
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
      const text = await readFile(reportPath, "utf8");
      const report = UiReport.parse(text);
      const grep = environment[UiSummary.GREP_VARIABLE] ?? "";
      const shard = environment[UiSummary.SHARD_VARIABLE] ?? "";
      const list = await this.listAsync([]);
      const reader = new UiTestReport(this.root, UiSummary.REPORT_SOURCE);
      const result = await reader.readAsync(JsonFields.parse(text, UiSummary.REPORT_SOURCE), list);
      const selection = grep.length === 0 ? list : await this.listAsync(["--grep", grep]);
      const totals = result.toTotals(UiSummary.RUNNER, UiSummary.TITLE, null, reader.listFiles(selection), shard.length === 0 ? null : shard).withRerunPassed(report.flakyTests.length);
      const summary = report.formatSummary(target, totals, environment[UiSummary.SCREENSHOT_VARIABLE], environment[UiSummary.UPLOAD_FAILED_VARIABLE] === UiSummary.TRUE);
      await appendFile(summaryPath, summary);
      this.output.write(summary);
      const recorded = await totals.recordAsync(this.root, this.output);
      await new FlakyRecord(this.root, environment).addAsync(report.flakyTests, this.output);
      return recorded ? 0 : 1;
    }
    catch (error) {
      if (!(error instanceof UiReportException) && !(error instanceof TotalsException))
        throw error;
      return await this.failAsync(summaryPath, target, error.message);
    }
  }

  private async listAsync(listArguments: readonly string[]): Promise<JsonFields> {
    const listed = await this.runner.captureAsync(process.execPath, [path.join(this.root, ...UiWorkflows.PLAYWRIGHT_CLI), "test", "--config", UiWorkflows.PLAYWRIGHT_CONFIG, "--list", "--reporter=json", ...listArguments], this.root, UiSummary.LIST_TIMEOUT);
    if (!listed.isSuccessful)
      throw new UiReportException(`${UiSummary.NOT_LISTED}\n${listed.text}`);
    return JsonFields.parse(listed.output, UiSummary.LIST_SOURCE);
  }

  private async failAsync(summaryPath: string, target: string, message: string): Promise<number> {
    await appendFile(summaryPath, `### UI workflows: ${target}\n\n${message}\n`);
    this.output.write(`${message}\n`);
    return 1;
  }
}

if (import.meta.main)
  process.exitCode = await new UiSummary(process.cwd(), process.stdout, new ProcessRunner()).runAsync(process.env);
