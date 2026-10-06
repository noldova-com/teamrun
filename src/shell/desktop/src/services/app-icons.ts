/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import type { TrayIconState } from "../enums/tray-icon-state.js";
import { Resources } from "../resources.js";

export class AppIcons {
  private readonly folder: string;
  private readonly platform: string;

  public constructor(folder: string, platform: string) {
    this.folder = folder;
    this.platform = platform;
  }

  public get window(): string {
    return join(this.folder, this.platform === Resources.windowsPlatform ? Resources.windowsIcon : Resources.windowIcon);
  }

  public get dock(): string {
    return join(this.folder, Resources.dockIcon);
  }

  public tray(state: TrayIconState): string {
    const name = `${Resources.trayIconPrefix}${state.toLowerCase()}`;
    const file = this.platform === Resources.windowsPlatform ? `${name}${Resources.trayWindowsExtension}`
      : this.platform === Resources.macPlatform ? `${name}${Resources.trayMacSuffix}` : `${name}${Resources.trayLinuxExtension}`;
    return join(this.folder, Resources.trayFolder, file);
  }
}
