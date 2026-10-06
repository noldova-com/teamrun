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
import CheckSelection from "./check-selection.ts";
import CoverageRun from "./coverage-run.ts";
import type FlakyRecord from "./flaky-record.ts";
import FlakyTest from "./flaky-test.ts";
import type ISelectableCheck from "./interfaces/selectable-check.ts";
import ScriptTestState from "./script-test-state.ts";

export default class ScriptTestCheck implements ISelectableCheck {
  private static readonly TEST_PATTERN: string = "scripts/tests/**/*.test.ts";
  private static readonly UNIT: string = "script test files";
  private static readonly REPORT_SEGMENTS: readonly string[] = ["_build", "script-tests.tap"];
  private static readonly REPORT_ENCODING: BufferEncoding = "utf8";
  private static readonly UNSELECTED_PATTERN: RegExp = /^ok \d+ - .+\.test\.ts$/gm;
  private static readonly SELECTED_ARGUMENTS: readonly string[] = ["--test", "--test-timeout=30000"];
  private static readonly TEST_ARGUMENTS: readonly string[] = [...ScriptTestCheck.SELECTED_ARGUMENTS, ScriptTestCheck.TEST_PATTERN];
  private static readonly COVERAGE_SEGMENTS: readonly string[] = ["_build", "script-coverage"];
  private static readonly STATE_SEGMENTS: readonly string[] = ["_build", "script-test-state.json"];
  private static readonly TESTS_PATH: string = "scripts/tests";
  private static readonly UNNAMED: string = "A run that failed and passed when run again, naming no test";
  private static readonly RERUNNING: string = "Running the failed script tests once more.\n";
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly PROJECT: string = "scripts";
  private static readonly TESTS_FOLDER: string = "tests";

  private readonly root: string;
  private readonly build: PackageBuild;
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly flaky: FlakyRecord | null;

  public readonly title: string = "Script tests and coverage";

  public constructor(root: string, build: PackageBuild, runner: ProcessRunner, environment: NodeJS.ProcessEnv, flaky: FlakyRecord | null) {
    this.root = root;
    this.build = build;
    this.runner = runner;
    this.environment = environment;
    this.flaky = flaky;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    if (!await this.build.isCurrentReportedAsync(BuildVariant.REGULAR, output))
      return false;

    const coverage = path.join(this.root, ...ScriptTestCheck.COVERAGE_SEGMENTS);
    await rm(coverage, { recursive: true, force: true });
    await mkdir(coverage, { recursive: true });
    const recording = CoverageRun.recordingIn(this.environment, coverage);
    const testsPassed = this.flaky === null
      ? await this.runner.runAsync(process.execPath, ScriptTestCheck.TEST_ARGUMENTS, this.root, recording) === 0
      : await this.runRerunningFailedAsync(recording, this.flaky, output);
    const scripts = path.join(this.root, ScriptTestCheck.PROJECT);
    const environment = { ...this.environment };
    delete environment[ScriptTestCheck.SUMMARY_VARIABLE];
    const covered = await new CoverageRun(this.root, this.runner).measureAsync(coverage, CoverageRun.formatProjectArguments(ScriptTestCheck.PROJECT, scripts, scripts, CoverageRun.NO_EXCLUSIONS, [ScriptTestCheck.TESTS_FOLDER]), environment);
    return testsPassed && covered;
  }

  public async runSelectedAsync(filters: readonly string[]): Promise<CheckSelection> {
    const files: string[] = [];
    for await (const file of glob(ScriptTestCheck.TEST_PATTERN, { cwd: this.root }))
      files.push(file.split(path.sep).join(path.posix.sep));
    files.sort();
    const named = files.filter(t => filters.some(u => t.includes(u)));
    if (named.length > 0)
      return new CheckSelection(await this.runner.runAsync(process.execPath, [...ScriptTestCheck.SELECTED_ARGUMENTS, ...named], this.root) === 0, ScriptTestCheck.UNIT, files.length, named.length);

    const report = path.join(this.root, ...ScriptTestCheck.REPORT_SEGMENTS);
    await rm(report, { force: true });
    await mkdir(path.dirname(report), { recursive: true });
    const patterns = filters.map(t => `--test-name-pattern=${RegExp.escape(t)}`);
    const exitCode = await this.runner.runAsync(
      process.execPath,
      [...ScriptTestCheck.SELECTED_ARGUMENTS, ...patterns, ...ScriptTestCheck.reportingTo(report), ...files],
      this.root);
    if (!existsSync(report))
      return new CheckSelection(false, ScriptTestCheck.UNIT, files.length, 0);
    const unselected = (await readFile(report, ScriptTestCheck.REPORT_ENCODING)).match(ScriptTestCheck.UNSELECTED_PATTERN)?.length ?? 0;
    return new CheckSelection(exitCode === 0, ScriptTestCheck.UNIT, files.length, files.length - unselected);
  }

  private async runRerunningFailedAsync(environment: NodeJS.ProcessEnv, flaky: FlakyRecord, output: Writable): Promise<boolean> {
    const state = path.join(this.root, ...ScriptTestCheck.STATE_SEGMENTS);
    const report = path.join(this.root, ...ScriptTestCheck.REPORT_SEGMENTS);
    await rm(state, { force: true });
    await rm(report, { force: true });
    await mkdir(path.dirname(state), { recursive: true });
    const commandArguments = [...ScriptTestCheck.SELECTED_ARGUMENTS, `--test-rerun-failures=${state}`, ...ScriptTestCheck.reportingTo(report), ScriptTestCheck.TEST_PATTERN];
    if (await this.runner.runAsync(process.execPath, commandArguments, this.root, environment) === 0)
      return true;
    const firstReport = existsSync(report) ? await readFile(report, ScriptTestCheck.REPORT_ENCODING) : "";
    output.write(ScriptTestCheck.RERUNNING);
    const isPassing = await this.runner.runAsync(process.execPath, commandArguments, this.root, environment) === 0;
    const tests = existsSync(state) ? ScriptTestState.readTests(this.root, await readFile(state, ScriptTestCheck.REPORT_ENCODING), firstReport) : [];
    await flaky.addAsync(tests.length > 0 || !isPassing ? tests : [new FlakyTest(ScriptTestState.RUNNER, ScriptTestCheck.TESTS_PATH, ScriptTestCheck.UNNAMED, firstReport)], output);
    return isPassing;
  }

  private static reportingTo(report: string): readonly string[] {
    return ["--test-reporter=spec", "--test-reporter-destination=stdout", "--test-reporter=tap", `--test-reporter-destination=${report}`];
  }
}
