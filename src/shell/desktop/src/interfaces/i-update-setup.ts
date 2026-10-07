/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IUpdateHandoff } from "./i-update-handoff.js";
import type { IUpdater } from "./i-updater.js";

export interface IUpdateSetup {
  readonly updater: IUpdater;
  readonly handoff: IUpdateHandoff;
}
