/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { NotificationConstructorOptions } from "electron";

import type { INotificationHost, ISystemNotification } from "@noldova/teamrun-shell-desktop";

import { ListenerRegistry } from "./listener-registry.fixture.js";

export class FakeSystemNotification implements ISystemNotification {
  private readonly listeners: ListenerRegistry = new ListenerRegistry();

  public readonly options: NotificationConstructorOptions;
  public isShown: boolean = false;
  public isClosed: boolean = false;

  public constructor(options: NotificationConstructorOptions) {
    this.options = options;
  }

  public get title(): string {
    return this.options.title ?? "";
  }

  public show(): void {
    this.isShown = true;
  }

  public close(): void {
    this.isClosed = true;
    this.listeners.emit("close");
  }

  public on(event: string, listener: (...values: never[]) => unknown): this {
    this.listeners.add(event, listener);
    return this;
  }

  public click(): void {
    this.listeners.emit("click");
  }

  public fail(error: string): void {
    this.listeners.emit("failed", {}, error);
  }
}

export class FakeNotificationHost implements INotificationHost {
  public readonly created: FakeSystemNotification[] = [];
  public isSupportedNow: boolean = true;

  public get open(): FakeSystemNotification[] {
    return this.created.filter(t => t.isShown && !t.isClosed);
  }

  public isSupported(): boolean {
    return this.isSupportedNow;
  }

  public create(options: NotificationConstructorOptions): FakeSystemNotification {
    const notification = new FakeSystemNotification(options);
    this.created.push(notification);
    return notification;
  }
}
