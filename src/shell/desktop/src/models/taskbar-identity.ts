/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import path from "node:path";

import type { AppDetailsOptions } from "electron";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class TaskbarIdentity {
  public readonly appId: string;
  public readonly iconPath: string;
  public readonly relaunchCommand: string;

  public constructor(appId: string, iconPath: string, relaunchCommand: string) {
    ArgumentException.throwIfNullOrWhitespace(appId, Resources.appIdParameter);
    ArgumentException.throwIfNullOrWhitespace(iconPath, Resources.iconPathParameter);
    ArgumentException.throwIfNullOrWhitespace(relaunchCommand, Resources.relaunchCommandParameter);

    this.appId = appId;
    this.iconPath = iconPath;
    this.relaunchCommand = relaunchCommand;
  }

  public static create(isPackaged: boolean, executablePath: string, mainScript: string, argv: readonly string[], workingDirectory: string): TaskbarIdentity {
    const kept = argv.flatMap(t => Resources.relaunchArgumentPrefixes
      .filter(prefix => t.startsWith(prefix))
      .map(prefix => `${prefix}${path.resolve(workingDirectory, t.slice(prefix.length))}`));
    const script = path.resolve(workingDirectory, mainScript);
    const parts = isPackaged ? [executablePath, ...kept] : [executablePath, script, ...kept];
    return new TaskbarIdentity(
      isPackaged ? Resources.appUserModelId : TaskbarIdentity.identifyCheckout(path.resolve(path.dirname(script), ...Resources.repositoryRootSegments)),
      executablePath,
      parts.map(t => `"${t}"`).join(" "));
  }

  public toAppDetails(): AppDetailsOptions {
    return {
      appId: this.appId,
      appIconPath: this.iconPath,
      appIconIndex: 0,
      relaunchCommand: this.relaunchCommand,
      relaunchDisplayName: Resources.applicationName
    };
  }

  private static identifyCheckout(checkout: string): string {
    const hash = createHash(Resources.checkoutHashAlgorithm).update(checkout).digest(Resources.hexEncoding).slice(0, Resources.checkoutHashLength);
    return `${Resources.developmentAppUserModelId}${Resources.idSeparator}${hash}`;
  }
}
