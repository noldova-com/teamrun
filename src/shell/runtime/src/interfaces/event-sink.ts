/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Event } from "@noldova/teamrun-shell-protocol";

export interface IEventSink {
  broadcast(event: Event): void;
}
