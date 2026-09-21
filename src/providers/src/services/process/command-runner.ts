/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { BoundedOutput } from "../../models/bounded-output.js";
import { CommandResult } from "../../models/command-result.js";
import type { ProcessCommand } from "../../models/process-command.js";
import { Resources } from "../../resources.js";
import type { ProcessTerminator } from "./process-terminator.js";

export class CommandRunner {
  private readonly terminator: ProcessTerminator;

  public constructor(terminator: ProcessTerminator) {
    this.terminator = terminator;
  }

  public run(command: ProcessCommand, environment: NodeJS.ProcessEnv, timeoutMilliseconds: number): Promise<CommandResult> {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(timeoutMilliseconds, Resources.timeoutParameterName);

    return new Promise((resolve, reject) => {
      const child = spawn(command.executable, command.arguments, { env: environment, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
      const stdout = new BoundedOutput(Resources.maximumOutputLength);
      const stderr = new BoundedOutput(Resources.maximumOutputLength);
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        void this.terminator.terminate(child);
      }, timeoutMilliseconds);
      child.stdout.setEncoding(Resources.utf8Encoding);
      child.stdout.on(Resources.dataEvent, (chunk: string) => stdout.append(chunk));
      child.stderr.setEncoding(Resources.utf8Encoding);
      child.stderr.on(Resources.dataEvent, (chunk: string) => stderr.append(chunk));
      child.on(Resources.errorEvent, (error: Error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on(Resources.closeEvent, (code: number | null, signal: NodeJS.Signals | null) => {
        clearTimeout(timer);
        resolve(new CommandResult(code, signal, stdout.toString(), stderr.toString(), timedOut));
      });
    });
  }
}
