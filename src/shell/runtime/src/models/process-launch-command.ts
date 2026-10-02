/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { accessSync, constants, readdirSync } from "node:fs";

import { ArgumentException, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { LaunchException } from "../exceptions/launch.exception.js";
import { Resources } from "../resources.js";

export class ProcessLaunchCommand {
  public readonly executable: string;
  public readonly arguments: readonly string[];

  public constructor(platform: string, executablePath: string, launchArguments: readonly string[]) {
    ArgumentException.throwIfNullOrWhitespace(executablePath, Resources.executablePathParameterName);
    const isLinux = platform === Resources.linuxPlatform;
    if (isLinux)
      ProcessLaunchCommand.requireLinuxPrerequisites();

    this.executable = isLinux ? Resources.launchShell : executablePath;
    this.arguments = isLinux ? [...Resources.launchShellArguments, executablePath, ...launchArguments] : [...launchArguments];
  }

  private static requireLinuxPrerequisites(): void {
    try {
      accessSync(Resources.launchShell, constants.X_OK);
    }
    catch (error) {
      throw new LaunchException(Resources.launchShellUnavailable, new ExceptionOptions(error));
    }
    try {
      accessSync(Resources.launchDescriptors, constants.R_OK | constants.X_OK);
      readdirSync(Resources.launchDescriptors);
    }
    catch (error) {
      throw new LaunchException(Resources.launchDescriptorsUnavailable, new ExceptionOptions(error));
    }
  }
}
