/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { homedir } from "node:os";
import type { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";

import { RuntimeBuild, RuntimeEntry } from "@noldova/teamrun-shell-runtime";

import { ExitCode } from "../enums/exit-code.js";
import { CliContext } from "../models/cli-context.js";
import { Cli } from "./cli.js";

export class CliEntry {
  public static get entryPath(): string {
    return fileURLToPath(import.meta.url);
  }

  public static createContext(running: NodeJS.Process): CliContext {
    return new CliContext(running.env, running.platform, homedir(), running.execPath, RuntimeEntry.entryPath, RuntimeBuild.identity,
      running.stdout, running.stderr, running.stdin, running);
  }

  public static async settleAsync(run: Promise<number>, error: Writable, exit: Pick<NodeJS.Process, "exitCode">): Promise<void> {
    try {
      exit.exitCode = await run;
    }
    catch (failure) {
      error.write(`${inspect(failure)}\n`);
      exit.exitCode = ExitCode.Failed;
    }
  }
}

if (import.meta.main)
  void CliEntry.settleAsync(new Cli(CliEntry.createContext(process)).runAsync(process.argv.slice(2)), process.stderr, process);
