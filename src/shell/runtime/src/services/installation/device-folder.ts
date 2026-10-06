/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/teamrun-foundation-core";

import { ProductInfo } from "../../models/product-info.js";
import { Resources } from "../../resources.js";

export class DeviceFolder {
  public static locate(platform: string, environment: NodeJS.ProcessEnv, homeFolder: string): string {
    const product = ProductInfo.current;
    if (platform === Resources.windowsPlatform)
      return path.join(environment[Resources.localAppDataVariable] ?? path.join(homeFolder, ...Resources.windowsLocalAppData), ...product.windowsDeviceFolder.split(Resources.folderSeparator));
    if (platform === Resources.macPlatform)
      return path.join(homeFolder, ...Resources.macApplicationSupport, ...product.macosDeviceFolder.split(Resources.folderSeparator));
    const state = environment[Resources.xdgStateVariable];
    const base = Object.isUndefined(state) || String.isNullOrWhitespace(state) ? path.join(homeFolder, ...Resources.xdgStateDefault) : state;
    return path.join(base, ...product.linuxDeviceFolder.split(Resources.folderSeparator));
  }
}
