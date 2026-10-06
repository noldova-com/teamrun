/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { glob, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import BuildVariant from "../modules/build-variant.ts";
import type PackageBuild from "../packages/package-build.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import RunnerResult from "../totals/runner-result.ts";
import TotalsException from "../totals/totals.exception.ts";
import CheckSelection from "./check-selection.ts";
import CoverageRun from "./coverage-run.ts";
import type ISelectableCheck from "./interfaces/selectable-check.ts";

export default class ScriptTestCheck implements ISelectableCheck {
  public static readonly RUNNER: string = "script";

  private static readonly TEST_PATTERN: string = "scripts/tests/**/*.test.ts";
  private static readonly UNIT: string = "script test files";
  private static readonly REPORT_SEGMENTS: readonly string[] = ["_build", "script-tests.tap"];
  private static readonly REPORT_ENCODING: BufferEncoding = "utf8";
  private static readonly UNSELECTED_PATTERN: RegExp = /^ok \d+ - .+\.test\.ts$/gm;
  private static readonly SELECTED_ARGUMENTS: readonly string[] = ["--test", "--test-timeout=30000"];
  private static readonly RESULT_SEGMENTS: readonly string[] = ["_build", "script-tests.json"];
  private static readonly COVERAGE_RESULT_SEGMENTS: readonly string[] = ["_build", "script-coverage.json"];
  private static readonly REPORTER: string = "./scripts/totals/script-test-reporter.ts";
  private static readonly TOTALS_TITLE: string = "Script tests";
  private static readonly COVERAGE_SEGMENTS: readonly string[] = ["_build", "script-coverage"];
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly PROJECT: string = "scripts";
  private static readonly TESTS_FOLDER: string = "tests";

  private readonly root: string;
  private readonly build: PackageBuild;
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;

  public readonly title: string = "Script tests and coverage";

  public constructor(root: string, build: PackageBuild, runner: ProcessRunner, environment: NodeJS.ProcessEnv) {
    this.root = root;
    this.build = build;
    this.runner = runner;
    this.environment = environment;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    if (!await this.build.isCurrentReportedAsync(BuildVariant.REGULAR, output))
      return false;

    const coverage = path.join(this.root, ...ScriptTestCheck.COVERAGE_SEGMENTS);
    const resultFile = path.join(this.root, ...ScriptTestCheck.RESULT_SEGMENTS);
    const coverageResult = path.join(this.root, ...ScriptTestCheck.COVERAGE_RESULT_SEGMENTS);
    await rm(coverage, { recursive: true, force: true });
    await mkdir(coverage, { recursive: true });
    await rm(resultFile, { force: true });
    await rm(coverageResult, { force: true });
    const testsPassed = await this.runner.runAsync(
      process.execPath,
      [...ScriptTestCheck.SELECTED_ARGUMENTS, "--test-reporter=spec", "--test-reporter-destination=stdout", `--test-reporter=${ScriptTestCheck.REPORTER}`, `--test-reporter-destination=${resultFile}`, ScriptTestCheck.TEST_PATTERN],
      this.root,
      CoverageRun.recordingIn(this.environment, coverage)) === 0;
    const scripts = path.join(this.root, ScriptTestCheck.PROJECT);
    const environment = CoverageRun.countingIn(this.environment, coverageResult);
    delete environment[ScriptTestCheck.SUMMARY_VARIABLE];
    const covered = await new CoverageRun(this.root, this.runner).measureAsync(coverage, CoverageRun.formatProjectArguments(ScriptTestCheck.PROJECT, scripts, scripts, CoverageRun.NO_EXCLUSIONS, [ScriptTestCheck.TESTS_FOLDER]), environment);
    try {
      const result = await RunnerResult.readAsync(this.root, resultFile);
      return await result.toTotals(ScriptTestCheck.RUNNER, ScriptTestCheck.TOTALS_TITLE, await CoverageRun.readCountAsync(this.root, coverageResult), await this.listAsync()).recordAsync(this.root, output) && testsPassed && covered;
    }
    catch (error) {
      if (!(error instanceof TotalsException))
        throw error;
      output.write(`${error.message}\n`);
      return false;
    }
  }

  public async runSelectedAsync(filters: readonly string[]): Promise<CheckSelection> {
    const files = await this.listAsync();
    const named = files.filter(t => filters.some(u => t.includes(u)));
    if (named.length > 0)
      return new CheckSelection(await this.runner.runAsync(process.execPath, [...ScriptTestCheck.SELECTED_ARGUMENTS, ...named], this.root) === 0, ScriptTestCheck.UNIT, files.length, named.length);

    const report = path.join(this.root, ...ScriptTestCheck.REPORT_SEGMENTS);
    await rm(report, { force: true });
    await mkdir(path.dirname(report), { recursive: true });
    const patterns = filters.map(t => `--test-name-pattern=${RegExp.escape(t)}`);
    const exitCode = await this.runner.runAsync(
      process.execPath,
      [...ScriptTestCheck.SELECTED_ARGUMENTS, ...patterns, "--test-reporter=spec", "--test-reporter-destination=stdout", "--test-reporter=tap", `--test-reporter-destination=${report}`, ...files],
      this.root);
    if (!existsSync(report))
      return new CheckSelection(false, ScriptTestCheck.UNIT, files.length, 0);
    const unselected = (await readFile(report, ScriptTestCheck.REPORT_ENCODING)).match(ScriptTestCheck.UNSELECTED_PATTERN)?.length ?? 0;
    return new CheckSelection(exitCode === 0, ScriptTestCheck.UNIT, files.length, files.length - unselected);
  }

  private async listAsync(): Promise<readonly string[]> {
    const files: string[] = [];
    for await (const file of glob(ScriptTestCheck.TEST_PATTERN, { cwd: this.root }))
      files.push(file.split(path.sep).join(path.posix.sep));
    return files.sort();
  }
}
