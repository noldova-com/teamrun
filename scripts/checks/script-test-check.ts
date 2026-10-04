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

import type ProcessRunner from "../processes/process-runner.ts";
import CheckSelection from "./check-selection.ts";
import type ISelectableCheck from "./interfaces/selectable-check.ts";

export default class ScriptTestCheck implements ISelectableCheck {
  private static readonly TEST_PATTERN: string = "scripts/tests/**/*.test.ts";
  private static readonly UNIT: string = "script test files";
  private static readonly REPORT_SEGMENTS: readonly string[] = ["_build", "script-tests.tap"];
  private static readonly REPORT_ENCODING: BufferEncoding = "utf8";
  private static readonly RESULT_PATTERN: RegExp = /^(?:not )?ok \d+ - (?!.*\.test\.ts$).+$/gm;
  private static readonly SELECTED_ARGUMENTS: readonly string[] = ["--test", "--test-timeout=30000"];
  private static readonly TEST_ARGUMENTS: readonly string[] = [
    "--test",
    "--test-timeout=30000",
    "--experimental-test-coverage",
    "--test-coverage-include-all",
    "--test-coverage-include=scripts/**/*.ts",
    "--test-coverage-exclude=scripts/tests/**",
    "--test-coverage-exclude=scripts/**/interfaces/**",
    "--test-coverage-lines=100",
    "--test-coverage-branches=100",
    "--test-coverage-functions=100",
    ScriptTestCheck.TEST_PATTERN
  ];

  private readonly root: string;
  private readonly runner: ProcessRunner;

  public readonly title: string = "Script tests and coverage";

  public constructor(root: string, runner: ProcessRunner) {
    this.root = root;
    this.runner = runner;
  }

  public async runAsync(): Promise<boolean> {
    return await this.runner.runAsync(process.execPath, ScriptTestCheck.TEST_ARGUMENTS, this.root) === 0;
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
      [...ScriptTestCheck.SELECTED_ARGUMENTS, ...patterns, "--test-reporter=spec", "--test-reporter-destination=stdout", "--test-reporter=tap", `--test-reporter-destination=${report}`, ...files],
      this.root);
    if (!existsSync(report))
      return new CheckSelection(false, ScriptTestCheck.UNIT, files.length, 0);
    const matched = (await readFile(report, ScriptTestCheck.REPORT_ENCODING)).match(ScriptTestCheck.RESULT_PATTERN)?.length ?? 0;
    return new CheckSelection(matched === 0 || exitCode === 0, ScriptTestCheck.UNIT, files.length, matched === 0 ? 0 : files.length);
  }
}
