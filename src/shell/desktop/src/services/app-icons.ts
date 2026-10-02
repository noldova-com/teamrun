/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import type { IThemeHost } from "../interfaces/i-theme-host.js";
import { Resources } from "../resources.js";

export class AppIcons {
  private readonly folder: string;
  private readonly platform: string;
  private readonly theme: IThemeHost;

  public constructor(folder: string, platform: string, theme: IThemeHost) {
    this.folder = folder;
    this.platform = platform;
    this.theme = theme;
  }

  public get window(): string {
    if (this.platform === Resources.windowsPlatform)
      return join(this.folder, this.theme.shouldUseDarkColorsForSystemIntegratedUI ? Resources.windowsDarkIcon : Resources.windowsLightIcon);
    return join(this.folder, this.theme.shouldUseDarkColors ? Resources.darkIcon : Resources.lightIcon);
  }

  public get dock(): string {
    return join(this.folder, Resources.dockIcon);
  }
}
