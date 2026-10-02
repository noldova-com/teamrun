/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class DesktopSettings {
  public readonly platform: string;
  public readonly windowIndexPath: string;
  public readonly preloadPath: string;

  public constructor(platform: string, windowIndexPath: string, preloadPath: string) {
    ArgumentException.throwIfNullOrWhitespace(platform, Resources.platformParameter);
    ArgumentException.throwIfNullOrWhitespace(windowIndexPath, Resources.windowIndexParameter);
    ArgumentException.throwIfNullOrWhitespace(preloadPath, Resources.preloadParameter);

    this.platform = platform;
    this.windowIndexPath = windowIndexPath;
    this.preloadPath = preloadPath;
  }

  public static fromModule(moduleDirectory: string, platform: string): DesktopSettings {
    return new DesktopSettings(
      platform,
      join(moduleDirectory, ...Resources.repositoryRootSegments, ...Resources.windowIndexSegments),
      join(moduleDirectory, Resources.preloadFileName));
  }

  public get windowUrl(): string {
    return pathToFileURL(this.windowIndexPath).href;
  }

  public get isMac(): boolean {
    return this.platform === Resources.macPlatform;
  }
}
