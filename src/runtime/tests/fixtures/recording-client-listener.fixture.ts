/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Event } from "@noldova/teamrun-protocol";
import type { IRuntimeClientListener } from "@noldova/teamrun-runtime";

export class RecordingClientListener implements IRuntimeClientListener {
  public readonly events: Event[] = [];
  public disconnections: number = 0;

  public get names(): readonly string[] {
    return this.events.map(t => t.name);
  }

  public onEvent(event: Event): void {
    this.events.push(event);
  }

  public onDisconnected(): void {
    this.disconnections += 1;
  }
}
