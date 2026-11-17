/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IEventListener } from "@noldova/teamrun.core";
import type { Event } from "@noldova/teamrun.protocol";

import { ChangeSignal } from "./change-signal.fixture.js";

export class RecordingEventListener implements IEventListener {
  public readonly events: Event[] = [];
  private readonly waits: { name: string; resolve: (event: Event) => void }[] = [];

  public onEvent(event: Event): void {
    this.events.push(event);
    ChangeSignal.notify();
    for (const wait of this.waits.filter(t => t.name === event.name)) {
      this.waits.splice(this.waits.indexOf(wait), 1);
      wait.resolve(event);
    }
  }

  public next(name: string): Promise<Event> {
    return new Promise(resolve => this.waits.push({ name, resolve }));
  }

  public names(): readonly string[] {
    return this.events.map(t => t.name);
  }

  public count(name: string): number {
    return this.events.filter(t => t.name === name).length;
  }
}
