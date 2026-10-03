/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { Notification } from "./notification.js";

export class NotificationState {
  private static readonly FIELDS: readonly string[] = [Resources.notificationsField, Resources.isDoNotDisturbField];

  public readonly notifications: readonly Notification[];
  public readonly isDoNotDisturb: boolean;

  public constructor(notifications: readonly Notification[], isDoNotDisturb: boolean) {
    this.notifications = [...notifications];
    this.isDoNotDisturb = isDoNotDisturb;
  }

  public static fromJson(value: unknown, path?: string): NotificationState {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, NotificationState.FIELDS);
    return WireContract.create(reader, () => new NotificationState(
      reader.readObjectArray(Resources.notificationsField).map(t => Notification.fromJson(t.toJson(), t.path)),
      reader.readBoolean(Resources.isDoNotDisturbField)));
  }

  public toJson(): JsonObject {
    return { [Resources.notificationsField]: this.notifications.map(t => t.toJson()), [Resources.isDoNotDisturbField]: this.isDoNotDisturb };
  }
}
