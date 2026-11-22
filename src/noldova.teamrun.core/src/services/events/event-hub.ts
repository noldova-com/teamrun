/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Event } from "@noldova/teamrun.protocol";

import type { IEventListener } from "../../interfaces/i-event-listener.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { ILog } from "../../interfaces/i-log.js";
import { EventSubscription } from "../../models/event-subscription.js";
import { Resources } from "../../resources.js";

export class EventHub implements IEventSink {
  private readonly listeners: Set<IEventListener> = new Set();
  private readonly log: ILog | null;

  public constructor(log: ILog | null = null) {
    this.log = log;
  }

  public get listenerCount(): number {
    return this.listeners.size;
  }

  public subscribe(listener: IEventListener): EventSubscription {
    this.listeners.add(listener);
    return new EventSubscription(this.listeners, listener);
  }

  public publish(event: Event): void {
    for (const listener of [...this.listeners]) {
      try {
        listener.onEvent(event);
      }
      catch (error) {
        this.log?.write(Resources.formatEventListenerFailed(event.name, Resources.formatFailureReason(error)));
      }
    }
  }
}
