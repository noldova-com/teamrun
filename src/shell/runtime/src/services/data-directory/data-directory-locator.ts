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
import { DataDirectory } from "./data-directory.js";

export class DataDirectoryLocator {
  public static locate(isPackaged: boolean, environment: NodeJS.ProcessEnv, homeFolder: string, checkoutRoot: string, explicit?: string): DataDirectory {
    if (!Object.isUndefined(explicit) && !String.isNullOrWhitespace(explicit))
      return new DataDirectory(explicit);
    if (isPackaged)
      return new DataDirectory(path.join(homeFolder, ...ProductInfo.current.dataFolder.split(Resources.folderSeparator)));

    const variable = environment[ProductInfo.current.dataDirectoryVariable];
    if (Object.isUndefined(variable) || String.isNullOrWhitespace(variable))
      return new DataDirectory(path.join(checkoutRoot, ...Resources.developmentDataFolder));
    return new DataDirectory(variable);
  }
}
