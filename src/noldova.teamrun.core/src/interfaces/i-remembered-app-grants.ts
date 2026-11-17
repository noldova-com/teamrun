/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { RememberedAppGrant } from "../models/remembered-app-grant.js";

export interface IRememberedAppGrants {
  list(): readonly RememberedAppGrant[];
  revoke(id: string): boolean;
}
