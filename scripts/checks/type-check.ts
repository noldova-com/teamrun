/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProcessRunner } from "../processes/process-runner.ts";
import { TypeScriptCompiler } from "../toolchain/typescript-compiler.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class TypeCheck implements ICheck {
  private static readonly PROJECT_OPTION: string = "--project";
  private static readonly PROJECTS: readonly string[] = ["scripts/tsconfig.json", "scripts/profile/tsconfig.json"];

  private readonly root: string;
  private readonly runner: ProcessRunner;

  public readonly title: string = "Script types";

  public constructor(root: string, runner: ProcessRunner) {
    this.root = root;
    this.runner = runner;
  }

  public async runAsync(): Promise<boolean> {
    let passed = true;
    for (const project of TypeCheck.PROJECTS)
      passed = await this.runner.runAsync(process.execPath, [TypeScriptCompiler.locate(), TypeCheck.PROJECT_OPTION, project], this.root) === 0 && passed;
    return passed;
  }
}
