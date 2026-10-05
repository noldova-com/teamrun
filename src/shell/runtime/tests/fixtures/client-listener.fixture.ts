/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Event, Failure } from "@noldova/teamrun-shell-protocol";
import type { IRuntimeClientListener } from "@noldova/teamrun-shell-runtime";

export class ClientListenerFixture implements IRuntimeClientListener {
  private readonly disconnected: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly waiters: [number, () => void][] = [];

  public readonly events: Event[] = [];
  public disconnections: number = 0;
  public failure: Failure | null = null;

  public get disconnectedAsync(): Promise<void> {
    return this.disconnected.promise;
  }

  public waitForEventsAsync(count: number): Promise<void> {
    if (this.events.length >= count)
      return Promise.resolve();
    return new Promise<void>(resolve => this.waiters.push([count, resolve]));
  }

  public onEvent(event: Event): void {
    this.events.push(event);
    for (const waiter of this.waiters.filter(t => this.events.length >= t[0])) {
      this.waiters.splice(this.waiters.indexOf(waiter), 1);
      waiter[1]();
    }
  }

  public onDisconnected(failure: Failure | null): void {
    this.disconnections++;
    this.failure = failure;
    this.disconnected.resolve();
  }
}
