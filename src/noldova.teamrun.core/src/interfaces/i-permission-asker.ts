/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PermissionAnswer } from "../enums/permission-answer.js";
import type { PermissionAsk } from "../models/permission-ask.js";

export interface IPermissionAsker {
  askPermissionAsync(session: string, module: string, ask: PermissionAsk, signal: AbortSignal): Promise<PermissionAnswer>;
}
