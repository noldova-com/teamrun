/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IConnectionFactory } from "../interfaces/i-connection-factory.js";
import type { IConnectionFactoryBuilder } from "../interfaces/i-connection-factory-builder.js";
import type { CliSettings } from "../models/cli-settings.js";
import { LauncherConnectionFactory } from "./launcher-connection-factory.js";

export class LauncherConnectionFactoryBuilder implements IConnectionFactoryBuilder {
  private readonly platform: string;
  private readonly executablePath: string;

  public constructor(platform: string, executablePath: string) {
    this.platform = platform;
    this.executablePath = executablePath;
  }

  public build(settings: CliSettings): IConnectionFactory {
    return new LauncherConnectionFactory(settings, this.platform, this.executablePath);
  }
}
