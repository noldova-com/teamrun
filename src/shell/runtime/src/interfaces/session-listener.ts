/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WireMessage } from "@noldova/teamrun-shell-protocol";

import type { ClientSession } from "../services/endpoint/client-session.js";

export interface ISessionListener {
  onMessage(session: ClientSession, message: WireMessage): void;

  onInvalidFrame(session: ClientSession, error: unknown): void;

  onClosed(session: ClientSession): void;
}
