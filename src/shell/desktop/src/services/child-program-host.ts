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
import { LaunchException, ProcessLaunchCommand } from "@noldova/teamrun-shell-runtime";

import { ProgramException } from "../exceptions/program.exception.js";
import type { IProgramHost } from "../interfaces/i-program-host.js";
import { StartedProgram } from "../models/started-program.js";
import { Resources } from "../resources.js";

export class ChildProgramHost implements IProgramHost {
  private readonly platform: string;
  private readonly timeout: number;

  public constructor(platform: string, timeout: number) {
    this.platform = platform;
    this.timeout = timeout;
  }

  public runAsync(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const fail = (error: Error): void => reject(new ProgramException(Resources.formatProgramFailed(file, error.message), new ExceptionOptions(error)));
      const command = this.commandFor(file, programArguments, environment, fail);
      if (Object.isNull(command))
        return;
      execFile(
        command.executable,
        [...command.arguments],
        { encoding: Resources.textEncoding, env: environment, maxBuffer: Resources.programOutputLimit, shell: false, timeout: this.timeout, windowsHide: true },
        (error, output) => {
          if (Object.isNull(error))
            resolve(output);
          else
            fail(error);
        });
    });
  }

  public start(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv, onOutput: (text: string) => void, onExit: () => void): StartedProgram {
    let isEnded = false;
    const end = (): void => {
      if (isEnded)
        return;
      isEnded = true;
      onExit();
    };
    const command = this.commandFor(file, programArguments, environment, () => setImmediate(end));
    if (Object.isNull(command))
      return new StartedProgram(() => undefined);
    const child = spawn(command.executable, [...command.arguments], { env: environment, shell: false, stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
    child.stdout.setEncoding(Resources.textEncoding);
    child.stdout.on(Resources.dataEvent, (t: string) => onOutput(t));
    child.on(Resources.errorEvent, end);
    child.on(Resources.closeEvent, end);
    return new StartedProgram(() => child.kill());
  }

  public startDetached(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv, onFailure: (error: Error) => void): void {
    const command = this.commandFor(file, programArguments, environment, onFailure);
    if (Object.isNull(command))
      return;
    const child = spawn(command.executable, [...command.arguments], { env: environment, detached: true, stdio: "ignore" });
    child.on(Resources.errorEvent, onFailure);
    child.unref();
  }

  private commandFor(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv, onFailure: (error: LaunchException) => void): ProcessLaunchCommand | null {
    try {
      return new ProcessLaunchCommand(this.platform, file, programArguments, environment, null);
    }
    catch (error) {
      if (!(error instanceof LaunchException))
        throw error;
      onFailure(error);
      return null;
    }
  }
}
