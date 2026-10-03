/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { NotificationConstructorOptions } from "electron";

import type { ISystemNotification } from "./i-system-notification.js";

export interface INotificationHost {
  isSupported(): boolean;
  create(options: NotificationConstructorOptions): ISystemNotification;
}
