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
import type { DoNotDisturbStore } from "./do-not-disturb-store.js";
import type { NotificationCenter } from "./notification-center.js";

export class NotificationsMethod implements IMethodHandler {
  private readonly notifications: NotificationCenter;
  private readonly store: DoNotDisturbStore;

  public constructor(notifications: NotificationCenter, store: DoNotDisturbStore) {
    this.notifications = notifications;
    this.store = store;
  }

  public async handleAsync(context: RequestContext): Promise<JsonValue> {
    const query = NotificationsQuery.fromJson(context.payload);
    return new NotificationState(this.notifications.list.notifications, this.store.isQuiet(query.device)).toJson();
  }
}
