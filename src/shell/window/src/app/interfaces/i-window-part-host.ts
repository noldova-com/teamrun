/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import type { NotificationPost } from "@noldova/teamrun-shell-protocol";

export interface IWindowPartHost {
  requestAsync(method: string, payload: JsonValue): Promise<JsonValue>;

  onEvent(listener: (name: string, payload: JsonValue) => void): () => void;

  openDocument(moduleId: string, name: string, instance: string, title: string, isPreview: boolean): void;

  keepDocument(moduleId: string, name: string, instance: string): void;

  isCommandRegistered(name: string): boolean;

  runCommandAsync(name: string, commandArguments: JsonValue): Promise<JsonValue>;

  postNotificationAsync(post: NotificationPost): Promise<number>;

  updateNotificationAsync(id: number, post: NotificationPost): Promise<void>;

  dismissNotification(id: number): void;

  refresh(): void;
}
