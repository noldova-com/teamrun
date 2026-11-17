/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EventChannel } from "@noldova/desktop.runtime";
import type { IEventListener } from "@noldova/teamrun.core";
import type { Event } from "@noldova/teamrun.protocol";

export class EventForwarder implements IEventListener {
  private readonly channels: ReadonlyMap<string, EventChannel>;

  public constructor(channels: ReadonlyMap<string, EventChannel>) {
    this.channels = channels;
  }

  public onEvent(event: Event): void {
    this.channels.get(event.name)?.publish(event.payload);
  }
}
