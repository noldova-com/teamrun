/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProcessExit } from "../models/process-exit.js";

export interface IExitHandler {
  handleExit(exit: ProcessExit): void;
}
