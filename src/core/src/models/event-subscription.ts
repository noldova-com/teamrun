/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IEventListener } from "../interfaces/i-event-listener.js";

export class EventSubscription implements Disposable {
  private readonly listeners: Set<IEventListener>;
  private readonly listener: IEventListener;

  public constructor(listeners: Set<IEventListener>, listener: IEventListener) {
    this.listeners = listeners;
    this.listener = listener;
  }

  public get isActive(): boolean {
    return this.listeners.has(this.listener);
  }

  public [Symbol.dispose](): void {
    this.listeners.delete(this.listener);
  }
}
