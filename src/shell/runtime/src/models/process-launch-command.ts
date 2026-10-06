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
import { AppImageSource } from "./app-image-source.js";
import { ProductInfo } from "./product-info.js";

export class ProcessLaunchCommand {
  public readonly executable: string;
  public readonly arguments: readonly string[];

  public constructor(platform: string, executablePath: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv = {}) {
    ArgumentException.throwIfNullOrWhitespace(executablePath, Resources.executablePathParameterName);
    if (platform !== Resources.linuxPlatform) {
      this.executable = executablePath;
      this.arguments = [...launchArguments];
      return;
    }
    ProcessLaunchCommand.requireLinuxPrerequisites();
    const name = `${ProductInfo.current.slug}${Resources.launchNameSuffix}`;
    const source = AppImageSource.find(environment, executablePath);
    this.executable = Resources.launchShell;
    this.arguments = Object.isNull(source)
      ? [...Resources.launchShellArguments, name, executablePath, ...launchArguments]
      : [...Resources.launchCopyShellArguments, name, source.file, source.folder, source.isMounted ? Resources.appImageMountMode : Resources.appImageExtractMode,
        executablePath, ...launchArguments];
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
