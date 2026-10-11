/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFile } from "node:fs/promises";
import type { Writable } from "node:stream";

import AngularProject from "./angular/angular-project.ts";
import AngularTestCheck from "./checks/angular-test-check.ts";
import FlakyRecord from "./checks/flaky-record.ts";
import type FlakyTest from "./checks/flaky-test.ts";
import type GateCheck from "./checks/gate-check.ts";
import GateChecks from "./checks/gate-checks.ts";
import type ICheck from "./checks/interfaces/i-check.ts";
import type IGateChecks from "./checks/interfaces/i-gate-checks.ts";
import type ISelectableCheck from "./checks/interfaces/i-selectable-check.ts";
import PackageTestCheck from "./checks/package-test-check.ts";
import ScriptTestCheck from "./checks/script-test-check.ts";
import type SelectedTests from "./checks/selected-tests.ts";
import PackageBuild from "./packages/package-build.ts";
import ProcessRunner from "./processes/process-runner.ts";
import TestOptions from "./test-options.ts";
import TestOptionsException from "./test-options.exception.ts";
import TestPart from "./test-part.ts";
import NpmCommand from "./toolchain/npm-command.ts";
import RunnerTotals from "./totals/runner-totals.ts";

export default class Test {
  private static readonly USAGE: string = "Usage: npm test [-- documents | [--filter <text>]... [--repeat <count>] [--rerun-failed] | [--part <part>] [--package <name>]... [--angular-tests] [--script-tests] [--repeat <count>] [--rerun-failed] | [--part <part>] --checks-only [--repeat <count>]]\n";
  private static readonly USAGE_EXIT_CODE: number = 2;
  private static readonly SUMMARY_HEADER: string = "| Check | Result |\n|---|---|\n";
  private static readonly FILTERED_SUMMARY_HEADER: string = "| Check | Result | Unit | Discovered | Selected | Unselected |\n|---|---|---|---|---|---|\n";
  private static readonly DOCUMENTS_NOTICE: string = "Filtered run: documents. A filtered run is not the complete gate.\n";
  private static readonly NO_MATCH: string = "No test matched the filters.\n";
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly RUNNERS: readonly string[] = [PackageTestCheck.RUNNER, ScriptTestCheck.RUNNER, AngularTestCheck.RUNNER];

  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly output: Writable;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly checks: IGateChecks;

  public constructor(root: string, runner: ProcessRunner, output: Writable, environment: NodeJS.ProcessEnv, checks?: IGateChecks) {
    this.root = root;
    this.runner = runner;
    this.output = output;
    this.environment = environment;
    this.checks = checks ?? new GateChecks(root, runner, environment);
  }

  public async runAsync(selection: readonly string[]): Promise<number> {
    let options: TestOptions;
    try {
      options = TestOptions.parse(selection);
    }
    catch (error) {
      if (!(error instanceof TestOptionsException))
        throw error;
      this.output.write(`${error.message}\n${Test.USAGE}`);
      return Test.USAGE_EXIT_CODE;
    }
    if (options.isDocuments)
      return await this.runChecksAsync(this.checks.createDocumentChecks(), Test.DOCUMENTS_NOTICE, null);

    const flaky = options.isRerunningFailed ? new FlakyRecord(this.root, this.environment) : null;
    await flaky?.clearAsync();

    for (let run = 1; run <= options.repeat; run++) {
      if (options.repeat > 1)
        this.output.write(`\nRun ${run} of ${options.repeat}\n`);
      const exitCode = options.filters.length === 0
        ? await this.runChecksAsync(await this.createChecksAsync(options.part, flaky, options.selection), Test.formatNotice(options), flaky)
        : await this.runFilteredAsync(options.filters, flaky);
      if (exitCode !== 0) {
        if (options.repeat > 1)
          this.output.write(`\nRun ${run} of ${options.repeat} failed; the repeats stop there.\n`);
        return exitCode;
      }
    }
    if (options.repeat > 1)
      this.output.write(`\nAll ${options.repeat} runs passed.\n`);
    return 0;
  }

  private async runChecksAsync(checks: readonly ICheck[], notice: string | null, flaky: FlakyRecord | null): Promise<number> {
    if (notice !== null)
      this.output.write(notice);
    const earlier = (await flaky?.readAsync())?.length ?? 0;

    await RunnerTotals.clearAsync(this.root);
    let summary = Test.SUMMARY_HEADER;
    let failures = 0;
    for (const check of checks) {
      this.output.write(`\n${check.title}\n`);
      const passed = await check.runAsync(this.output);
      this.output.write(`${check.title}: ${passed ? "passed" : "failed"}\n`);
      summary += `| ${check.title} | ${passed ? "Passed" : "Failed"} |\n`;
      if (!passed)
        failures++;
    }

    const rerunPassed = Test.countByRunner((await flaky?.readAsync() ?? []).slice(earlier));
    const totals = (await RunnerTotals.readAllAsync(this.root, Test.RUNNERS)).map(t => t.withRerunPassed(rerunPassed.get(t.title) ?? 0));
    if (totals.length > 0) {
      for (const runner of totals)
        await runner.writeAsync(this.root);
      this.output.write(`\nTest totals\n${totals.map(t => t.formatLine()).join("")}`);
      summary += `\n${RunnerTotals.formatTable(totals)}`;
    }
    this.output.write(`\n${checks.length - failures} of ${checks.length} checks passed.\n`);
    await this.writeSummaryAsync(summary);
    return failures === 0 ? 0 : 1;
  }

  private async writeSummaryAsync(summary: string): Promise<void> {
    const summaryPath = this.environment[Test.SUMMARY_VARIABLE];
    if (summaryPath !== undefined)
      await appendFile(summaryPath, summary);
  }

  private async runFilteredAsync(filters: readonly string[], flaky: FlakyRecord | null): Promise<number> {
    this.output.write(`Filtered run: ${filters.map(t => JSON.stringify(t)).join(", ")}. A filtered run is not the complete gate.\n`);
    const build = new PackageBuild(this.root, this.runner, this.environment, process.platform, process.arch);
    const angular = new AngularProject(this.root, this.runner, new NpmCommand(this.runner, this.environment));
    const checks: readonly ISelectableCheck[] = [
      new PackageTestCheck(this.root, build, this.runner, this.environment, flaky),
      new ScriptTestCheck(this.root, build, this.runner, this.environment, flaky),
      new AngularTestCheck(angular, flaky)
    ];

    let summary = `Filters: ${filters.map(t => Test.formatSummaryFilter(t)).join(" ")}\n\n${Test.FILTERED_SUMMARY_HEADER}`;
    let failures = 0;
    let selected = 0;
    for (const check of checks) {
      this.output.write(`\n${check.title}\n`);
      const selection = await check.runSelectedAsync(filters, this.output);
      const result = !selection.isPassing ? "Failed" : selection.selected === 0 ? "None selected" : "Passed";
      this.output.write(`${check.title}: ${result.toLowerCase()}; ${selection.selected} of ${selection.discovered} ${selection.unit} selected, ${selection.unselected} not selected.\n`);
      summary += `| ${check.title} | ${result} | ${selection.unit} | ${selection.discovered} | ${selection.selected} | ${selection.unselected} |\n`;
      selected += selection.selected;
      if (!selection.isPassing)
        failures++;
    }
    if (selected === 0) {
      this.output.write(Test.NO_MATCH);
      summary += `\n${Test.NO_MATCH}`;
      failures++;
    }

    this.output.write(`\n${checks.length - failures} of ${checks.length} checks passed.\n`);
    await this.writeSummaryAsync(summary);
    return failures === 0 ? 0 : 1;
  }

  private static formatNotice(options: TestOptions): string | null {
    const part = options.part === null ? "" : `Part run: ${options.part}. Only all ${TestPart.ALL.length} parts together are the complete gate.\n`;
    const selection = options.selection === undefined ? "" : `Selected run: every check other than the tests, and ${options.selection.description}. A selected run is not the complete gate.\n`;
    return part + selection === "" ? null : part + selection;
  }

  private static formatSummaryFilter(filter: string): string {
    return `<code>${filter.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("|", "&#124;")}</code>`;
  }

  private static countByRunner(tests: readonly FlakyTest[]): ReadonlyMap<string, number> {
    const counts = new Map<string, number>();
    for (const test of tests)
      counts.set(test.runner, (counts.get(test.runner) ?? 0) + 1);
    return counts;
  }

  private async createChecksAsync(part: string | null, flaky: FlakyRecord | null, selection?: SelectedTests): Promise<readonly ICheck[]> {
    const checks = await this.checks.createAsync(flaky, selection?.packages);
    return checks.filter(t => (part === null || t.part === part) && Test.isSelected(t, selection)).map(t => t.check);
  }

  private static isSelected(check: GateCheck, selection: SelectedTests | undefined): boolean {
    if (selection === undefined || check.runner === null)
      return true;
    if (check.runner === PackageTestCheck.RUNNER)
      return selection.packages.length > 0;
    return check.runner === ScriptTestCheck.RUNNER ? selection.runsScriptTests : selection.runsAngularTests;
  }
}

if (import.meta.main)
  process.exitCode = await new Test(process.cwd(), new ProcessRunner(), process.stdout, process.env).runAsync(process.argv.slice(2));
