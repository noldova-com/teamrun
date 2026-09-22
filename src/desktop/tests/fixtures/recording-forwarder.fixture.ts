/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Event } from "@noldova/teamrun-protocol";
import type { IEventForwarder } from "@noldova/teamrun-desktop";

export class RecordingForwarder implements IEventForwarder {
  public readonly events: Event[] = [];

  public get names(): readonly string[] {
    return this.events.map(t => t.name);
  }

  public forward(event: Event): void {
    this.events.push(event);
  }
}
