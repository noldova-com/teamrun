/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources.js";

export class DownloadAddress {
  public static isSafe(url: string): boolean {
    if (!URL.canParse(url))
      return false;
    const parsed = new URL(url);
    return parsed.protocol === Resources.acpRegistryHttpsProtocol
      || (parsed.protocol === Resources.acpRegistryHttpProtocol && Resources.acpRegistryLoopbackHosts.includes(parsed.hostname));
  }
}
