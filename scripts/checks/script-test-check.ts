/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProcessRunner } from "../processes/process-runner.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class ScriptTestCheck implements ICheck {
  private static readonly TEST_ARGUMENTS: readonly string[] = ["--test", "scripts/profile/tests/**/*.test.ts", "scripts/angular/tests/**/*.test.ts", "scripts/checks/tests/**/*.test.ts", "scripts/structure/tests/**/*.test.ts", "scripts/packages/tests/**/*.test.ts", "scripts/installs/tests/**/*.test.ts"];

  private readonly root: string;
  private readonly runner: ProcessRunner;

  public readonly title: string = "Script tests";

  public constructor(root: string, runner: ProcessRunner) {
    this.root = root;
    this.runner = runner;
  }

  public async runAsync(): Promise<boolean> {
    return await this.runner.runAsync(process.execPath, ScriptTestCheck.TEST_ARGUMENTS, this.root) === 0;
  }
}
