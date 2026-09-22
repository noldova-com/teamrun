/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ClientSession } from "../services/endpoint/client-session.js";

export interface ISessionListener {
  onLine(session: ClientSession, line: string): void;
  onClosed(session: ClientSession): void;
}
