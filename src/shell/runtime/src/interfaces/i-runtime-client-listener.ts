/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Event, Failure } from "@noldova/teamrun-shell-protocol";

export interface IRuntimeClientListener {
  onEvent(event: Event): void;

  onDisconnected(failure: Failure | null): void;
}
