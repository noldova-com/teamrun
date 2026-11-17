/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleSettings } from "@noldova/desktop.runtime";

import { Resources } from "../resources.js";

export class IdleCompactionSetting {
  public static readerOf(settings: IModuleSettings): () => boolean {
    return () => settings.read(Resources.idleCompactionSetting) !== false;
  }
}
