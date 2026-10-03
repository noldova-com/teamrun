/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { Failure, FailureCode, NotificationUpdate } from "@noldova/teamrun-shell-protocol";

import { MethodFailureException } from "../../exceptions/method-failure.exception.js";
import type { IMethodHandler } from "../../interfaces/method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import { Resources } from "../../resources.js";
import type { NotificationCenter } from "./notification-center.js";
import type { NotificationPolicy } from "./notification-policy.js";

export class UpdateNotificationMethod implements IMethodHandler {
  private readonly notifications: NotificationCenter;
  private readonly policy: NotificationPolicy;

  public constructor(notifications: NotificationCenter, policy: NotificationPolicy) {
    this.notifications = notifications;
    this.policy = policy;
  }

  public async handleAsync(context: RequestContext): Promise<JsonValue> {
    const update = NotificationUpdate.fromJson(context.payload);
    const current = this.notifications.find(update.id);
    if (Object.isUndefined(current))
      throw new MethodFailureException(new Failure(FailureCode.NotFound, Resources.formatNotificationNotFound(update.id)));
    const refusal = current.post.kind.text === update.post.kind.text
      ? this.policy.findRefusal(update.post)
      : Resources.formatNotificationKindChanged(update.id, current.post.kind.text);
    if (!Object.isNull(refusal))
      throw new MethodFailureException(new Failure(FailureCode.InvalidParams, refusal));
    this.notifications.update(update.id, update.post);
    return null;
  }
}
