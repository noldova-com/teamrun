/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WindowOpenHandlerResponse } from "electron";

import type { IWindowContents } from "@noldova/teamrun-shell-desktop";

import { FakePreventableEvent } from "./fake-preventable-event.fixture.js";
import { ListenerRegistry } from "./listener-registry.fixture.js";

export class FakeWindowContents implements IWindowContents {
  private readonly listeners: ListenerRegistry = new ListenerRegistry();
  private openHandler: (() => WindowOpenHandlerResponse) | null = null;

  public readonly id: number;
  public readonly sent: unknown[][] = [];

  public constructor(id: number) {
    this.id = id;
  }

  public on(event: string, listener: (...values: never[]) => void): this {
    this.listeners.add(event, listener);
    return this;
  }

  public setWindowOpenHandler(handler: () => WindowOpenHandlerResponse): void {
    this.openHandler = handler;
  }

  public send(channel: string, ...values: unknown[]): void {
    this.sent.push([channel, ...values]);
  }

  public navigate(event: string, url?: string): boolean {
    const preventable = new FakePreventableEvent();
    this.listeners.emit(event, preventable, url);
    return preventable.isPrevented;
  }

  public openWindow(): WindowOpenHandlerResponse | undefined {
    return this.openHandler?.();
  }
}
