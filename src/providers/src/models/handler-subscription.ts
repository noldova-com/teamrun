/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class HandlerSubscription<T> implements Disposable {
  private readonly handlers: Set<T>;
  private readonly handler: T;

  public constructor(handlers: Set<T>, handler: T) {
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
