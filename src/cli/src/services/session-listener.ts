/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Event } from "@noldova/teamrun-protocol";
import type { IRuntimeClientListener } from "@noldova/teamrun-runtime";

import type { IEventHandler } from "../interfaces/i-event-handler.js";
import { EventSubscription } from "../models/event-subscription.js";

export class SessionListener implements IRuntimeClientListener {
  private readonly handlers: Set<IEventHandler> = new Set();
  private disconnected: boolean = false;

  public get isDisconnected(): boolean {
    return this.disconnected;
  }

  public subscribe(handler: IEventHandler): EventSubscription {
    this.handlers.add(handler);
    return new EventSubscription(this.handlers, handler);
  }

  public onEvent(event: Event): void {
    for (const handler of this.handlers)
      handler.handleEvent(event);
  }

  public onDisconnected(): void {
    this.disconnected = true;
  }
}
