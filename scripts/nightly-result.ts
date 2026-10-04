/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";
import { stripVTControlCharacters } from "node:util";

import NightlyFailure from "./workflows/nightly-failure.ts";
import NightlyLegResult from "./workflows/nightly-leg-result.ts";
import UiReport from "./workflows/ui-report.ts";
import UiReportException from "./workflows/ui-report.exception.ts";

export default class NightlyResult {
  public static readonly RESULT_SEGMENTS: readonly string[] = ["_build", "nightly", "results"];
  public static readonly TESTS_LOG_SEGMENTS: readonly string[] = ["_build", "nightly", "tests.log"];

  private static readonly LABEL_VARIABLE: string = "NIGHTLY_LABEL";
  private static readonly PART_VARIABLE: string = "NIGHTLY_PART";
  private static readonly OUTCOME_VARIABLE: string = "NIGHTLY_OUTCOME";
  private static readonly TESTS_PART: string = "tests";
  private static readonly WORKFLOWS_PART: string = "workflows";
  private static readonly SUCCESS: string = "success";
  private static readonly CANCELLED: string = "cancelled";
  private static readonly REPORT_SEGMENTS: readonly string[] = ["_build", "ui", "report.json"];
  private static readonly FAILED_CHECK: RegExp = /^(.+): failed$/u;
  private static readonly TAG: RegExp = / @[\w-]+/gu;
  private static readonly NOT_A_FILE_NAME: RegExp = /[^a-z0-9]+/gu;
  private static readonly TESTS_PREFIX: string = "npm test › ";
  private static readonly WHOLE_RUN: string = " › the run itself";
  private static readonly CHECK_FAILED: string = "The check failed in one of the five runs; the job's log names the test and the run.";
  private static readonly TIMED_OUT: string = "It timed out or was cancelled.";
  private static readonly UNNAMED: string = "It failed without naming a failing check or workflow.";
  private static readonly VARIABLES_REQUIRED: string = "NIGHTLY_LABEL, NIGHTLY_PART (tests or workflows) and NIGHTLY_OUTCOME must describe the job.\n";

  private readonly root: string;
  private readonly output: Writable;

  public constructor(root: string, output: Writable) {
    this.root = root;
    this.output = output;
  }

  public static fileNameOf(label: string): string {
    return `${label.toLowerCase().replace(NightlyResult.NOT_A_FILE_NAME, "-")}.json`;
  }

  public async runAsync(environment: NodeJS.ProcessEnv): Promise<number> {
    const label = environment[NightlyResult.LABEL_VARIABLE] ?? "";
    const part = environment[NightlyResult.PART_VARIABLE] ?? "";
    const outcome = environment[NightlyResult.OUTCOME_VARIABLE] ?? "";
    if (label.length === 0 || outcome.length === 0 || ![NightlyResult.TESTS_PART, NightlyResult.WORKFLOWS_PART].includes(part)) {
      this.output.write(NightlyResult.VARIABLES_REQUIRED);
      return 1;
    }

    const named = outcome === NightlyResult.SUCCESS ? [] : part === NightlyResult.TESTS_PART ? await this.readChecksAsync() : await this.readWorkflowsAsync();
    const failures = outcome === NightlyResult.SUCCESS || named.length > 0 ? named
      : [new NightlyFailure(`${label}${NightlyResult.WHOLE_RUN}`, outcome === NightlyResult.CANCELLED ? NightlyResult.TIMED_OUT : NightlyResult.UNNAMED, 1)];
    const folder = path.join(this.root, ...NightlyResult.RESULT_SEGMENTS);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, NightlyResult.fileNameOf(label)), new NightlyLegResult(label, failures).toJson());
    this.output.write(`${label}: ${failures.length === 0 ? "passed" : failures.map(t => `${t.name} failed`).join("; ")}\n`);
    return 0;
  }

  private async readChecksAsync(): Promise<readonly NightlyFailure[]> {
    const log = path.join(this.root, ...NightlyResult.TESTS_LOG_SEGMENTS);
    if (!existsSync(log))
      return [];
    const checks = stripVTControlCharacters(await readFile(log, "utf8")).split(/\r?\n/u).flatMap(t => NightlyResult.FAILED_CHECK.exec(t.trim())?.slice(1, 2) ?? []);
    return [...new Set(checks)].map(t => new NightlyFailure(`${NightlyResult.TESTS_PREFIX}${t}`, NightlyResult.CHECK_FAILED, 1));
  }

  private async readWorkflowsAsync(): Promise<readonly NightlyFailure[]> {
    const reportPath = path.join(this.root, ...NightlyResult.REPORT_SEGMENTS);
    if (!existsSync(reportPath))
      return [];
    let report: UiReport;
    try {
      report = UiReport.parse(await readFile(reportPath, "utf8"));
    }
    catch (error) {
      if (!(error instanceof UiReportException))
        throw error;
      return [];
    }
    const grouped = new Map<string, NightlyFailure>();
    for (const failure of report.failures) {
      const name = failure.title.replace(NightlyResult.TAG, "");
      const known = grouped.get(name);
      grouped.set(name, new NightlyFailure(name, known?.message ?? failure.message, (known?.count ?? 0) + 1));
    }
    return [...grouped.values()];
  }
}

if (import.meta.main)
  process.exitCode = await new NightlyResult(process.cwd(), process.stdout).runAsync(process.env);
