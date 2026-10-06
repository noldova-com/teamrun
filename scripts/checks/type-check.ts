/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ProcessRunner from "../processes/process-runner.ts";
import TypeScriptCompiler from "../toolchain/typescript-compiler.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class TypeCheck implements ICheck {
  private static readonly PROJECT_ARGUMENTS: readonly string[] = ["--project", "scripts/tsconfig.json"];

  private readonly root: string;
  private readonly runner: ProcessRunner;

  public readonly title: string = "Script types";

  public constructor(root: string, runner: ProcessRunner) {
    this.root = root;
    this.runner = runner;
  }

  public async runAsync(): Promise<boolean> {
    return await this.runner.runAsync(process.execPath, [TypeScriptCompiler.locate(), ...TypeCheck.PROJECT_ARGUMENTS], this.root) === 0;
  }
}
