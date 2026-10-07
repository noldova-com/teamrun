/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { AppImageSource, type IProcessStarter } from "@noldova/teamrun-shell-runtime";

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
    this.environment = Object.fromEntries(Object.entries(environment).filter(([name]) => !Resources.appImageVariables.includes(name)));
    this.processId = processId;
    this.errorFile = errorFile;
  }

  public static find(platform: string, environment: NodeJS.ProcessEnv, executablePath: string, launchArguments: readonly string[], starter: IProcessStarter, processId: number,
    errorFile: string): AppImageRestart | null {
    const source = platform === Resources.linuxPlatform ? AppImageSource.find(environment, executablePath) : null;
    return Object.isNull(source) ? null : new AppImageRestart(starter, source.file, launchArguments, environment, processId, errorFile);
  }

  public async startAsync(): Promise<void> {
    this.started = await this.starter.startAsync(Resources.restartShell, [...Resources.restartShellArguments, Resources.restartName, String(this.processId), this.image, ...this.launchArguments],
      this.environment, this.errorFile);
  }

  public cancel(): void {
    const started = this.started;
    this.started = null;
    if (!Object.isNull(started))
      AppImageRestart.end(started);
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
