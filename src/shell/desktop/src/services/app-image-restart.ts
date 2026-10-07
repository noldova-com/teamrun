/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { AppImageSource, type IProcessStarter, ProcessLaunchCommand } from "@noldova/teamrun-shell-runtime";

import { Resources } from "../resources.js";

export class AppImageRestart {
  private readonly starter: IProcessStarter;
  private readonly image: string;
  private readonly launchArguments: readonly string[];
  private readonly environment: NodeJS.ProcessEnv;
  private readonly processId: number;
  private readonly errorFile: string;
  private started: number | null = null;

  private constructor(starter: IProcessStarter, image: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, processId: number, errorFile: string) {
    this.starter = starter;
    this.image = image;
    this.launchArguments = [...launchArguments];
    this.environment = AppImageRestart.restore(environment);
    this.processId = processId;
    this.errorFile = errorFile;
  }

  public static find(platform: string, environment: NodeJS.ProcessEnv, executablePath: string, launchArguments: readonly string[], starter: IProcessStarter, processId: number,
    errorFile: string): AppImageRestart | null {
    const source = platform === Resources.linuxPlatform ? AppImageSource.find(environment, executablePath) : null;
    return Object.isNull(source) ? null : new AppImageRestart(starter, source.file, launchArguments, environment, processId, errorFile);
  }

  public async startAsync(): Promise<void> {
    const command = new ProcessLaunchCommand(Resources.linuxPlatform, Resources.restartShell,
      [...Resources.restartShellArguments, Resources.restartName, String(this.processId), this.image, ...this.launchArguments], this.environment, null);
    this.started = await this.starter.startAsync(command.executable, command.arguments, this.environment, this.errorFile);
  }

  public cancel(): void {
    const started = this.started;
    this.started = null;
    if (!Object.isNull(started))
      AppImageRestart.end(started);
  }

  private static restore(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const folder = String(environment[Resources.appImageFolderVariable]);
    return Object.fromEntries(Object.entries(environment).flatMap(([name, value]): [string, string][] => {
      const restored = Object.isUndefined(value) || Resources.appImageVariables.includes(name) ? null : AppImageRestart.unwrap(name, value, folder);
      return Object.isNull(restored) ? [] : [[name, restored]];
    }));
  }

  private static unwrap(name: string, value: string, folder: string): string | null {
    const wrapping = Resources.appRunPathVariables.find(([variable]) => variable === name);
    if (Object.isUndefined(wrapping))
      return value;
    const [, prepended, appended] = wrapping;
    const entries = value.split(Resources.pathListSeparator);
    const isWrapped = prepended.every((t, i) => entries[i] === `${folder}${t}`) && appended.every((t, i) => entries.at(i - appended.length) === t);
    const kept = entries.slice(prepended.length, entries.length - appended.length);
    return !isWrapped ? value : kept.length === 0 ? null : kept.join(Resources.pathListSeparator);
  }

  private static end(processId: number): void {
    try {
      process.kill(processId);
    }
    catch {
      return;
    }
  }
}
