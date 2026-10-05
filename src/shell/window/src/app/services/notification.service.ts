/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, ErrorHandler, Injectable, type Signal, type WritableSignal, computed, effect, inject, signal, untracked } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { type CommandRun, NotificationReference, NotificationState, ShellEvents, ShellMethods } from "@noldova/teamrun-shell-protocol";

import { Resources } from "../../resources";
import { RuntimeRequestException } from "../exceptions/runtime-request.exception";
import { CommandService } from "./command.service";
import { DesktopBridgeService } from "./desktop-bridge.service";
import { SettingsService } from "./settings.service";
import { WindowPartHostService } from "./window-part-host.service";

@Injectable({ providedIn: "root" })
export class NotificationService {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly commands: CommandService = inject(CommandService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly stateValue: WritableSignal<NotificationState> = signal(new NotificationState([], false, [], 0));
  private readonly firstReadValue: WritableSignal<NotificationState | null> = signal(null);
  private eventsSeen: number = 0;
  private generationRead: number = 0;

  public readonly state: Signal<NotificationState> = this.stateValue.asReadonly();
  public readonly firstRead: Signal<NotificationState | null> = this.firstReadValue.asReadonly();
  public readonly unreadCount: Signal<number> = computed(() => {
    const state = this.stateValue();
    return state.notifications.filter(t => !t.isRead && !state.mutedModules.includes(t.post.kind.owner)).length;
  });

  public constructor() {
    const host = inject(WindowPartHostService);
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(this.bridge.onEvent((name, payload) => this.receive(name, payload)));
    destroyRef.onDestroy(this.bridge.onNotificationOpened(t => this.open(t)));
    effect(() => {
      const generation = host.generation();
      if (generation > this.generationRead) {
        this.generationRead = generation;
        untracked(() => this.load());
      }
    });
  }

  public isAvailable(command: CommandRun): boolean {
    return this.commands.isAvailable(command.name.text, command.commandArguments);
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

  public dismiss(id: string): void {
    this.send(ShellMethods.dismissNotification.text, new NotificationReference(id).toJson());
  }

  public setDoNotDisturb(isOn: boolean): void {
    this.settings.setAsync(Resources.doNotDisturbSetting, isOn).catch((error: unknown) => this.errors.handleError(error));
  }

  private open(id: string): void {
    const command = this.stateValue().notifications.find(t => t.id === id)?.post.open ?? null;
    if (!Object.isNull(command) && this.isAvailable(command))
      this.runAsync(command).catch((error: unknown) => this.errors.handleError(error));
  }

  private load(): void {
    const seen = this.eventsSeen;
    this.bridge.requestAsync(ShellMethods.notifications.text, {}).then(t => {
      const state = NotificationState.fromJson(t);
      if (this.eventsSeen === seen)
        this.stateValue.set(state);
      this.firstReadValue.set(state);
    }).catch((error: unknown) => {
      if (!RuntimeRequestException.isDisconnected(error))
        this.errors.handleError(error);
    });
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
