/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IEventListener } from "@noldova/teamrun-core";
import type { Event } from "@noldova/teamrun-protocol";

export class RecordingEventListener implements IEventListener {
  public readonly events: Event[] = [];

  public onEvent(event: Event): void {
    this.events.push(event);
  }

  public names(): readonly string[] {
    return this.events.map(t => t.name);
  }

  public count(name: string): number {
    return this.events.filter(t => t.name === name).length;
  }
}
