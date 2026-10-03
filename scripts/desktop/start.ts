/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { realpathSync } from "node:fs";
import path from "node:path";
import type { Writable } from "node:stream";

import ProcessRunner from "../processes/process-runner.ts";
import DevelopmentBinary from "./development-binary.ts";
import SandboxHelper from "./sandbox-helper.ts";

export default class Start {
  private static readonly MAIN_SEGMENTS: readonly string[] = ["node_modules", "@noldova", "teamrun-shell-desktop", "main.js"];
  private static readonly RUN_AS_NODE_VARIABLE: string = "ELECTRON_RUN_AS_NODE";
  private static readonly FAILURE_EXIT_CODE: number = 1;

  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly binary: DevelopmentBinary;
  private readonly sandbox: SandboxHelper;

  public constructor(root: string, runner: ProcessRunner, binary: DevelopmentBinary, sandbox: SandboxHelper) {
    this.root = root;
    this.runner = runner;
    this.binary = binary;
    this.sandbox = sandbox;
  }

  public async runAsync(commandArguments: readonly string[], environment: NodeJS.ProcessEnv, report: Writable): Promise<number> {
    const executable = await this.binary.prepareAsync(report);
    const problem = await this.sandbox.findProblemAsync(executable);
    if (problem !== null) {
      report.write(problem);
      return Start.FAILURE_EXIT_CODE;
    }
    const launched = Object.fromEntries(Object.entries(environment).filter(([name]) => name !== Start.RUN_AS_NODE_VARIABLE));
    const exitCode = await this.runner.runAsync(executable, [path.join(this.root, ...Start.MAIN_SEGMENTS), ...commandArguments], this.root, launched);
    return exitCode ?? Start.FAILURE_EXIT_CODE;
  }
}

if (import.meta.main) {
  const root = realpathSync(process.cwd());
  const runner = new ProcessRunner();
  const sandbox = new SandboxHelper(process.platform, SandboxHelper.readOptionalTextAsync, SandboxHelper.statOptionalAsync);
  process.exitCode = await new Start(root, runner, new DevelopmentBinary(root, runner), sandbox).runAsync(process.argv.slice(2), process.env, process.stdout);
}
