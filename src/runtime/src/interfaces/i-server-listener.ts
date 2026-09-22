/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Request } from "@noldova/teamrun-protocol";

export interface IServerListener {
  onSessionCountChanged(count: number): void;
  onResponseSent?(request: Request): void;
}
