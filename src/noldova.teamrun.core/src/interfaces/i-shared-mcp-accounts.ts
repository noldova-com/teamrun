/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SharedMcpAccount } from "@noldova/teamrun.protocol";

import type { SharedMcpAccess } from "../models/shared-mcp-access.js";

export interface ISharedMcpAccounts {
  accessAsync(account: SharedMcpAccount): Promise<SharedMcpAccess>;
}
