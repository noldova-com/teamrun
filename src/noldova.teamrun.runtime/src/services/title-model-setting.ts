/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IModuleSettings } from "@noldova/desktop.runtime";

import { Resources } from "../resources.js";

export class TitleModelSetting {
  public static readerOf(settings: IModuleSettings): () => string {
    return () => {
      const value = settings.read(Resources.titleModelSetting);
      return typeof value === "string" ? value : String.empty;
    };
  }
}
