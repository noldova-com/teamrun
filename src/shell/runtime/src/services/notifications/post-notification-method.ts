/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { Failure, FailureCode, NotificationPost, NotificationReference } from "@noldova/teamrun-shell-protocol";

import { MethodFailureException } from "../../exceptions/method-failure.exception.js";
import type { IMethodHandler } from "../../interfaces/method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import type { NotificationCenter } from "./notification-center.js";
import type { NotificationPolicy } from "./notification-policy.js";

export class PostNotificationMethod implements IMethodHandler {
  private readonly notifications: NotificationCenter;
  private readonly policy: NotificationPolicy;

  public constructor(notifications: NotificationCenter, policy: NotificationPolicy) {
    this.notifications = notifications;
    this.policy = policy;
  }

  public async handleAsync(context: RequestContext): Promise<JsonValue> {
    const post = NotificationPost.fromJson(context.payload);
    const refusal = this.policy.findRefusal(post);
    if (!Object.isNull(refusal))
      throw new MethodFailureException(new Failure(FailureCode.InvalidParams, refusal));
    return new NotificationReference(this.notifications.post(post)).toJson();
  }
}
