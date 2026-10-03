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

export default class TeamRunCommand {
  private static readonly ENTRY_SEGMENTS: readonly string[] = ["node_modules", "@noldova", "teamrun-shell-cli", "services", "cli-entry.js"];
  private static readonly RUN_AS_NODE_VARIABLE: string = "ELECTRON_RUN_AS_NODE";
  private static readonly RUN_AS_NODE_VALUE: string = "1";
  private static readonly CHECKOUT_VARIABLE: string = "TEAMRUN_CHECKOUT";
  private static readonly STARTING_FOLDER_VARIABLE: string = "INIT_CWD";
  private static readonly FAILURE_EXIT_CODE: number = 1;

  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly binary: DevelopmentBinary;

  public constructor(root: string, runner: ProcessRunner, binary: DevelopmentBinary) {
    this.root = root;
    this.runner = runner;
    this.binary = binary;
  }

  public async runAsync(commandArguments: readonly string[], environment: NodeJS.ProcessEnv, report: Writable): Promise<number> {
    const executable = await this.binary.prepareAsync(report);
    const launched = { ...environment, [TeamRunCommand.RUN_AS_NODE_VARIABLE]: TeamRunCommand.RUN_AS_NODE_VALUE, [TeamRunCommand.CHECKOUT_VARIABLE]: this.root };
    const folder = environment[TeamRunCommand.STARTING_FOLDER_VARIABLE] ?? this.root;
    const exitCode = await this.runner.runAsync(executable, [path.join(this.root, ...TeamRunCommand.ENTRY_SEGMENTS), ...commandArguments], folder, launched);
    return exitCode ?? TeamRunCommand.FAILURE_EXIT_CODE;
  }
}

if (import.meta.main) {
  const root = realpathSync(process.cwd());
  const runner = new ProcessRunner();
  process.exitCode = await new TeamRunCommand(root, runner, new DevelopmentBinary(root, runner)).runAsync(process.argv.slice(2), process.env, process.stderr);
}
