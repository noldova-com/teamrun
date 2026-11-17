/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RuntimeTerminalOwners } from "@noldova/terminal.protocol";

export class RecordingTerminalOwners extends RuntimeTerminalOwners {
  public readonly closed: string[] = [];
  public failure: Error | null = null;

  public override closeAsync(owner: string): Promise<void> {
    this.closed.push(owner);
    return this.failure === null ? Promise.resolve() : Promise.reject(this.failure);
  }

  public override bindAgentSession(): void {
    throw new Error("TeamRun binds its sessions with terminal.owner.");
  }

  public override unbindAgentSession(): void {
    throw new Error("TeamRun binds its sessions with terminal.owner.");
  }
}
