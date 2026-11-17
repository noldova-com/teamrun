/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleSettings } from "@noldova/desktop.runtime";

import { Resources } from "../resources.js";

export class HopLimitSetting {
  public static readerOf(settings: IModuleSettings): () => number {
    return () => {
      const value = settings.read(Resources.chainHopLimitSetting);
      return typeof value === "number" ? value : 0;
    };
  }
}
