/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";
import type { NotificationPost, SettingScope } from "@noldova/teamrun-shell-protocol";

import type { CommandContribution } from "../models/command-contribution";
import type { DocumentContribution } from "../models/document-contribution";
import type { MenuRowContribution } from "../models/menu-row-contribution";
import type { NotificationHandle } from "../models/notification-handle";
import type { StatusBarItem } from "../models/status-bar-item";
import type { StatusBarItemContribution } from "../models/status-bar-item-contribution";
import type { TopBarAction } from "../models/top-bar-action";
import type { TopBarActionContribution } from "../models/top-bar-action-contribution";
import type { ViewContribution } from "../models/view-contribution";
import type { IDocumentOptions } from "./i-document-options";

export interface IWindowPartContext {
  registerView(view: ViewContribution): void;
  registerDocument(document: DocumentContribution): void;
  registerCommand(command: CommandContribution): void;
  registerStatusBarItem(item: StatusBarItemContribution): StatusBarItem;
  registerTopBarAction(action: TopBarActionContribution): TopBarAction;
  provideMenuGroup(group: string, provider: (context: JsonObject) => readonly MenuRowContribution[]): () => void;
  isAllowed(name: string): boolean;
  runCommandAsync(name: string, commandArguments?: JsonValue): Promise<JsonValue>;
  postNotificationAsync(post: NotificationPost): Promise<NotificationHandle>;
  openDocument(name: string, instance: string, title: string, options?: IDocumentOptions): void;
  keepDocument(name: string, instance: string): void;
  log(message: string): void;
  requestAsync(method: string, parameters: JsonValue): Promise<JsonValue>;
  onEvent(event: string, listener: (payload: JsonValue) => void): () => void;
  readSetting(name: string): JsonValue | undefined;
  writeSettingAsync(name: string, value: JsonValue, scope?: SettingScope | null): Promise<void>;
  resetSettingAsync(name: string, scope?: SettingScope | null): Promise<void>;
  onSettingChanged(name: string, listener: (value: JsonValue, scope: SettingScope | null) => void): () => void;
}
