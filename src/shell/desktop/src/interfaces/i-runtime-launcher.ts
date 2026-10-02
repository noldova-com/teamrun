/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { StopPolicy } from "@noldova/teamrun-shell-protocol";
import type { IRuntimeClientListener } from "@noldova/teamrun-shell-runtime";

import type { IRuntimeConnection } from "./i-runtime-connection.js";

export interface IRuntimeLauncher {
  attachAsync(clientName: string, listener: IRuntimeClientListener, policy?: StopPolicy): Promise<IRuntimeConnection>;
  moveAsideAsync(clientName: string, listener: IRuntimeClientListener, policy?: StopPolicy): Promise<IRuntimeConnection>;
}
