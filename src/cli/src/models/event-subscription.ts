/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IEventHandler } from "../interfaces/i-event-handler.js";

export class EventSubscription implements Disposable {
  private readonly handlers: Set<IEventHandler>;
  private readonly handler: IEventHandler;

  public constructor(handlers: Set<IEventHandler>, handler: IEventHandler) {
    this.handlers = handlers;
    this.handler = handler;
  }

  public get isActive(): boolean {
    return this.handlers.has(this.handler);
  }

  public [Symbol.dispose](): void {
    this.handlers.delete(this.handler);
  }
}
