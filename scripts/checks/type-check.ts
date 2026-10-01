/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createRequire } from "node:module";
import path from "node:path";

import type ProcessRunner from "../processes/process-runner.ts";
import type ICheck from "./interfaces/check.ts";

export default class TypeCheck implements ICheck {
  private static readonly ROOT_MANIFEST: string = "package.json";
  private static readonly COMPILER_MANIFEST: string = "typescript/package.json";
  private static readonly COMPILER_PATH: string = "bin/tsc";
  private static readonly PROJECT_ARGUMENTS: readonly string[] = ["--project", "scripts/tsconfig.json"];

  private readonly root: string;
  private readonly runner: ProcessRunner;

  public readonly title: string = "Script types";

  public constructor(root: string, runner: ProcessRunner) {
    this.root = root;
    this.runner = runner;
  }

  public async runAsync(): Promise<boolean> {
    const manifest = createRequire(path.join(this.root, TypeCheck.ROOT_MANIFEST)).resolve(TypeCheck.COMPILER_MANIFEST);
    const compiler = path.join(path.dirname(manifest), TypeCheck.COMPILER_PATH);
    return await this.runner.runAsync(process.execPath, [compiler, ...TypeCheck.PROJECT_ARGUMENTS], this.root) === 0;
  }
}
