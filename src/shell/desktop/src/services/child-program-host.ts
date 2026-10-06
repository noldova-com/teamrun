/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile, spawn } from "node:child_process";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { ProgramException } from "../exceptions/program.exception.js";
import type { IProgramHost } from "../interfaces/i-program-host.js";
import { StartedProgram } from "../models/started-program.js";
import { Resources } from "../resources.js";

export class ChildProgramHost implements IProgramHost {
  private readonly timeout: number;

  public constructor(timeout: number) {
    this.timeout = timeout;
  }

  public runAsync(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      execFile(
        file,
        [...programArguments],
        { encoding: Resources.textEncoding, env: environment, maxBuffer: Resources.programOutputLimit, shell: false, timeout: this.timeout, windowsHide: true },
        (error, output) => {
          if (Object.isNull(error))
            resolve(output);
          else
            reject(new ProgramException(Resources.formatProgramFailed(file, error.message), new ExceptionOptions(error)));
        });
    });
  }

  public start(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv, onOutput: (text: string) => void, onExit: () => void): StartedProgram {
    const child = spawn(file, [...programArguments], { env: environment, shell: false, stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
    let isEnded = false;
    const end = (): void => {
      if (isEnded)
        return;
      isEnded = true;
      onExit();
    };
    child.stdout.setEncoding(Resources.textEncoding);
    child.stdout.on(Resources.dataEvent, (t: string) => onOutput(t));
    child.on(Resources.errorEvent, end);
    child.on(Resources.closeEvent, end);
    return new StartedProgram(() => child.kill());
  }
}
