/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ProcessRunner from "../processes/process-runner.ts";
import type ICheck from "./interfaces/check.ts";

export default class ScriptTestCheck implements ICheck {
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
    "scripts/tests/**/*.test.ts"
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
}
