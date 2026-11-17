/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SharedMcpAccess } from "../models/shared-mcp-access.js";

export interface ISharedMcpSignIn {
  startAsync(url: string, reference: string, finished: (access: SharedMcpAccess) => void): Promise<string>;
  accessAsync(url: string, reference: string): Promise<SharedMcpAccess>;
  signOutAsync(reference: string): Promise<void>;
}
