/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRuntimeClientListener, RuntimeClient, RuntimeLock } from "@noldova/teamrun-runtime";

export interface IConnectionFactory {
  readLiveLock(): RuntimeLock | null;
  connect(listener: IRuntimeClientListener): Promise<RuntimeClient>;
}
