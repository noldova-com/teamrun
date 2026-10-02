/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPermissionHost } from "./i-permission-host.js";

export interface ISessionHost {
  readonly defaultSession: IPermissionHost;
}
