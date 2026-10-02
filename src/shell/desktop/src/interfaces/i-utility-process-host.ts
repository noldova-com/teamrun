/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IUtilityProcess } from "./i-utility-process.js";

export interface IUtilityProcessHost {
  fork(modulePath: string, args: string[], options: { stdio: "ignore"; serviceName: string }): IUtilityProcess;
}
