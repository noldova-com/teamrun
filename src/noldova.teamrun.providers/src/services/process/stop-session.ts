/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IPowershellSession } from "../../interfaces/i-powershell-session.js";

/**
 * The kept PowerShell one stop on Windows runs its scripts in, until a script fails or runs out of time there.
 */
export class StopSession {
  private current: IPowershellSession | null;

  /**
   * Starts a stop on the kept PowerShell.
   * @param session The kept PowerShell; null runs every script of the stop in a new PowerShell.
   */
  public constructor(session: IPowershellSession | null) {
    this.current = session;
  }

  /**
   * The kept PowerShell, or null once a script failed or ran out of time there.
   */
  public get session(): IPowershellSession | null {
    return this.current;
  }

  /**
   * Runs the rest of the stop's scripts in new PowerShells.
   */
  public leave(): void {
    this.current = null;
  }
}
