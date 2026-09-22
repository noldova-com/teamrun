/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  type IRuntimeClientListener,
  RuntimeClient,
  RuntimeEntry,
  RuntimeLauncher,
  type RuntimeLock,
  RuntimeSettings,
  RuntimeTimings
} from "@noldova/teamrun-runtime";

import type { IConnectionFactory } from "../interfaces/i-connection-factory.js";
import type { CliSettings } from "../models/cli-settings.js";
import { Resources } from "../resources.js";

export class LauncherConnectionFactory implements IConnectionFactory {
  private readonly launcher: RuntimeLauncher;

  public constructor(settings: CliSettings, platform: string, executablePath: string) {
    const runtimeSettings = RuntimeSettings.forPlatform(platform, settings.dataDirectory, settings.productVersion, settings.idleGraceMilliseconds);
    const timings = RuntimeTimings.createDefault();
    this.launcher = new RuntimeLauncher(runtimeSettings, executablePath, RuntimeEntry.entryPath, settings.runtimeArguments, process.env, timings);
  }

  public readLiveLock(): RuntimeLock | null {
    return this.launcher.readLiveLock();
  }

  public connect(listener: IRuntimeClientListener): Promise<RuntimeClient> {
    return this.launcher.attach(Resources.clientName, listener);
  }
}
