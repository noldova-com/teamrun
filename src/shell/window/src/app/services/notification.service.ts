/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, ErrorHandler, Injectable, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { type CommandRun, NotificationReference, NotificationState, ShellEvents, ShellMethods } from "@noldova/teamrun-shell-protocol";

import type { StartupState } from "../models/startup-state";
import { Resources } from "../../resources";
import { CommandService } from "./command.service";
import { DesktopBridgeService } from "./desktop-bridge.service";

@Injectable({ providedIn: "root" })
export class NotificationService {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly commands: CommandService = inject(CommandService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly stateValue: WritableSignal<NotificationState> = signal(new NotificationState([], false));
  private isReady: boolean = false;
  private eventsSeen: number = 0;

  public readonly state: Signal<NotificationState> = this.stateValue.asReadonly();
  public readonly unreadCount: Signal<number> = computed(() => this.stateValue().notifications.filter(t => !t.isRead).length);

  public constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(this.bridge.onStartup(t => this.follow(t)));
    destroyRef.onDestroy(this.bridge.onEvent((name, payload) => this.receive(name, payload)));
    void this.bridge.readStartupAsync().then(t => this.follow(t));
  }

  public isAvailable(command: CommandRun): boolean {
    return this.commands.commands().some(t => t.name === command.name.text);
  }

  public runAsync(command: CommandRun): Promise<JsonValue> {
    return this.commands.runAsync(command.name.text, command.commandArguments);
  }

  public markAllRead(): void {
    this.send(ShellMethods.markNotificationsRead.text, null);
  }

  public clear(): void {
    this.send(ShellMethods.clearNotifications.text, null);
  }

  public dismiss(id: number): void {
    this.send(ShellMethods.dismissNotification.text, new NotificationReference(id).toJson());
  }

  public setDoNotDisturb(isOn: boolean): void {
    this.send(ShellMethods.setDoNotDisturb.text, { [Resources.isOnField]: isOn });
  }

  private follow(state: StartupState): void {
    if (state.isReady && !this.isReady)
      this.load();
    this.isReady = state.isReady;
  }

  private load(): void {
    const seen = this.eventsSeen;
    this.bridge.requestAsync(ShellMethods.notifications.text, {}).then(t => {
      if (this.eventsSeen === seen)
        this.stateValue.set(NotificationState.fromJson(t));
    }).catch((error: unknown) => this.errors.handleError(error));
  }

  private receive(name: string, payload: JsonValue): void {
    if (name !== ShellEvents.notifications.text)
      return;
    this.eventsSeen++;
    try {
      this.stateValue.set(NotificationState.fromJson(payload));
    }
    catch (error) {
      this.errors.handleError(error);
    }
  }

  private send(method: string, payload: JsonValue): void {
    this.bridge.requestAsync(method, payload).catch((error: unknown) => this.errors.handleError(error));
  }
}
