/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { NotificationState, NotificationsQuery } from "@noldova/teamrun-shell-protocol";

import type { IMethodHandler } from "../../interfaces/method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import type { NotificationCenter } from "./notification-center.js";
import type { NotificationSettings } from "./notification-settings.js";

export class NotificationsMethod implements IMethodHandler {
  private readonly notifications: NotificationCenter;
  private readonly settings: NotificationSettings;

  public constructor(notifications: NotificationCenter, settings: NotificationSettings) {
    this.notifications = notifications;
    this.settings = settings;
  }

  public async handleAsync(context: RequestContext): Promise<JsonValue> {
    const query = NotificationsQuery.fromJson(context.payload);
    return new NotificationState(this.notifications.list.notifications, this.settings.isQuiet(query.device), this.settings.mutedModules, this.notifications.sequence).toJson();
  }
}
