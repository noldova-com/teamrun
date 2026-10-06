/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";

import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import type { NotificationCenter } from "./notification-center.js";

export class MarkNotificationsReadMethod implements IMethodHandler {
  private readonly notifications: NotificationCenter;

  public constructor(notifications: NotificationCenter) {
    this.notifications = notifications;
  }

  public async handleAsync(_context: RequestContext): Promise<JsonValue> {
    this.notifications.markAllRead();
    return null;
  }
}
