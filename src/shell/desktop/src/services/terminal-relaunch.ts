/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { AppImageSource } from "@noldova/teamrun-shell-runtime";

import type { IDesktopProcess } from "../interfaces/i-desktop-process.js";
import { Resources } from "../resources.js";
import { AppImageEnvironment } from "./app-image-environment.js";

export class TerminalRelaunch {
  private readonly process: IDesktopProcess;
  private readonly executablePath: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly workingDirectory: string;

  private constructor(process: IDesktopProcess, executablePath: string, environment: NodeJS.ProcessEnv, workingDirectory: string) {
    this.process = process;
    this.executablePath = executablePath;
    this.environment = environment;
    this.workingDirectory = workingDirectory;
  }

  public static find(process: IDesktopProcess, isPackaged: boolean): TerminalRelaunch | null {
    if (!isPackaged || !process.isTerminal || !Resources.relaunchPlatforms.includes(process.platform) || TerminalRelaunch.writesToTheTerminal(process))
      return null;
    const source = process.platform === Resources.linuxPlatform ? AppImageSource.find(process.env, process.execPath) : null;
    return Object.isNull(source)
      ? new TerminalRelaunch(process, process.execPath, process.env, process.workingDirectory)
      : new TerminalRelaunch(process, source.file, AppImageEnvironment.restore(process.env), process.env[Resources.appImageWorkingFolderVariable] ?? process.workingDirectory);
  }

  public startAsync(): Promise<void> {
    return this.process.startDetachedAsync(this.executablePath, this.process.argv.slice(1), this.environment, this.workingDirectory);
  }

  private static writesToTheTerminal(process: IDesktopProcess): boolean {
    return (process.env[Resources.enableLoggingVariable] ?? String.empty).length > 0
      || process.argv.slice(1).some(t => Resources.terminalArguments.some(u => t === u || t.startsWith(`${u}=`)));
  }
}
