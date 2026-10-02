/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IIpcEvent, IIpcHost } from "@noldova/teamrun-shell-desktop";

import { ListenerRegistry } from "./listener-registry.fixture.js";

export class FakeIpcHost implements IIpcHost {
  private readonly listeners: ListenerRegistry = new ListenerRegistry();
  private readonly handlers: ListenerRegistry = new ListenerRegistry();

  public on(channel: string, listener: (event: IIpcEvent, ...values: unknown[]) => void): this {
    this.listeners.add(channel, listener);
    return this;
  }

  public handle(channel: string, listener: (event: IIpcEvent, ...values: unknown[]) => unknown): void {
    this.handlers.add(channel, listener);
  }

  public send(channel: string, event: IIpcEvent, ...values: unknown[]): void {
    this.listeners.emit(channel, event, ...values);
  }

  public invoke(channel: string, event: IIpcEvent, ...values: unknown[]): unknown {
    return this.handlers.emit(channel, event, ...values)[0];
  }
}
