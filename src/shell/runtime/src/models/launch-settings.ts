/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";
import type { DataDirectory } from "../services/data-directory/data-directory.js";
import { ClientSettings } from "./client-settings.js";

export class LaunchSettings {
  public readonly dataDirectory: DataDirectory;
  public readonly executablePath: string;
  public readonly entryPath: string;
  public readonly environment: NodeJS.ProcessEnv;
  public readonly platform: string;
  public readonly idleGraceMilliseconds: number;
  public readonly launchTimeout: number;
  public readonly pollInterval: number;
  public readonly clientSettings: ClientSettings;

  public constructor(
    dataDirectory: DataDirectory,
    executablePath: string,
    entryPath: string,
    environment: NodeJS.ProcessEnv,
    platform: string,
    idleGraceMilliseconds: number = Resources.idleGrace,
    launchTimeout: number = Resources.launchTimeout,
    pollInterval: number = Resources.launchPollInterval,
    clientSettings: ClientSettings = new ClientSettings()) {
    ArgumentException.throwIfNullOrWhitespace(executablePath, Resources.executablePathParameterName);
    ArgumentException.throwIfNullOrWhitespace(entryPath, Resources.entryPathParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(idleGraceMilliseconds, Resources.idleGraceParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(launchTimeout, Resources.launchTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(pollInterval, Resources.pollIntervalParameterName);

    this.dataDirectory = dataDirectory;
    this.executablePath = executablePath;
    this.entryPath = entryPath;
    this.environment = environment;
    this.platform = platform;
    this.idleGraceMilliseconds = idleGraceMilliseconds;
    this.launchTimeout = launchTimeout;
    this.pollInterval = pollInterval;
    this.clientSettings = clientSettings;
  }
}
