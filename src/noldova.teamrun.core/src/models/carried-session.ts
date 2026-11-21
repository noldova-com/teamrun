/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SessionCarry } from "../enums/session-carry.js";

export class CarriedSession {
  public readonly carry: SessionCarry;
  public readonly sessionId: string;

  public constructor(carry: SessionCarry, sessionId: string) {
    this.carry = carry;
    this.sessionId = sessionId;
  }
}
