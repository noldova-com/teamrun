/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";
import type { NotificationPost, SettingChange, SettingEntry, SettingScope } from "@noldova/teamrun-shell-protocol";

import type { DocumentHeading } from "../models/document-heading";
import type { MenuItem } from "../models/menu-item";
import type { ViewBadge } from "../models/view-badge";

export interface IWindowPartHost {
  requestAsync(method: string, payload: JsonValue): Promise<JsonValue>;

  onEvent(listener: (name: string, payload: JsonValue) => void): () => void;

  openDocument(moduleId: string, name: string, instance: string, heading: DocumentHeading, isPreview: boolean): void;

  keepDocument(moduleId: string, name: string, instance: string): void;

  updateDocument(moduleId: string, name: string, instance: string, title: string | null, breadcrumb: readonly string[] | null): void;

  showInDialogAsync(name: string, instance: string | null, title: string | null): Promise<void>;

  log(moduleId: string, message: string): void;

  openLinkAsync(url: string): Promise<void>;

  isCommandRegistered(name: string): boolean;

  declaresDynamicMenuGroup(moduleId: string, group: string): boolean;

  provideMenuGroup(group: string, provider: (context: JsonObject) => readonly MenuItem[]): () => void;

  runCommandAsync(name: string, commandArguments: JsonValue): Promise<JsonValue>;

  postNotificationAsync(post: NotificationPost): Promise<string>;

  updateNotificationAsync(id: string, post: NotificationPost): Promise<boolean>;

  dismissNotification(id: string): void;

  readSetting(name: string): JsonValue | undefined;

  readSettingAsync(name: string, scope: SettingScope | null): Promise<SettingEntry>;

  writeSettingAsync(name: string, value: JsonValue, scope: SettingScope | null): Promise<void>;

  resetSettingAsync(name: string, scope: SettingScope | null): Promise<void>;

  onSettingChanged(listener: (change: SettingChange) => void): () => void;

  setViewBadge(view: string, badge: ViewBadge | null): void;

  setTabWorking(tabKey: string, isWorking: boolean): void;

  refresh(): void;
}
