/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { NotificationReference } from "@noldova/teamrun-shell-protocol";

import type { IMethodHandler } from "../../interfaces/method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import type { NotificationCenter } from "./notification-center.js";

export class DismissNotificationMethod implements IMethodHandler {
  private readonly notifications: NotificationCenter;

  public constructor(notifications: NotificationCenter) {
    this.notifications = notifications;
  }

  public async handleAsync(context: RequestContext): Promise<JsonValue> {
    this.notifications.dismiss(NotificationReference.fromJson(context.payload).id);
    return null;
  }
}
