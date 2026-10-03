/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";
import type { MenuItem } from "../models/menu-item";
import type { NotificationPost, SettingChange, SettingScope } from "@noldova/teamrun-shell-protocol";

export interface IWindowPartHost {
  requestAsync(method: string, payload: JsonValue): Promise<JsonValue>;

  onEvent(listener: (name: string, payload: JsonValue) => void): () => void;

  openDocument(moduleId: string, name: string, instance: string, title: string, isPreview: boolean): void;

  keepDocument(moduleId: string, name: string, instance: string): void;

  log(moduleId: string, message: string): void;

  isCommandRegistered(name: string): boolean;

  declaresDynamicMenuGroup(moduleId: string, group: string): boolean;

  provideMenuGroup(group: string, provider: (context: JsonObject) => readonly MenuItem[]): () => void;

  runCommandAsync(name: string, commandArguments: JsonValue): Promise<JsonValue>;

  postNotificationAsync(post: NotificationPost): Promise<number>;

  updateNotificationAsync(id: number, post: NotificationPost): Promise<void>;

  dismissNotification(id: number): void;

  readSetting(name: string): JsonValue | undefined;

  writeSettingAsync(name: string, value: JsonValue, scope: SettingScope | null): Promise<void>;

  resetSettingAsync(name: string, scope: SettingScope | null): Promise<void>;

  onSettingChanged(listener: (change: SettingChange) => void): () => void;

  refresh(): void;
}
