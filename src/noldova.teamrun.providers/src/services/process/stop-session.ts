/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IPowershellSession } from "../../interfaces/i-powershell-session.js";

export class StopSession {
  private current: IPowershellSession | null;

  public constructor(session: IPowershellSession | null) {
    this.current = session;
  }

  public get session(): IPowershellSession | null {
    return this.current;
  }

  public leave(): void {
    this.current = null;
  }
}
