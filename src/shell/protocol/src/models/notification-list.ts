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

export class NotificationList {
  private static readonly FIELDS: readonly string[] = [Resources.notificationsField];

  public readonly notifications: readonly Notification[];

  public constructor(notifications: readonly Notification[]) {
    this.notifications = [...notifications];
  }

  public static fromJson(value: unknown, path?: string): NotificationList {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, NotificationList.FIELDS);
    return WireContract.create(reader, () => new NotificationList(
      reader.readObjectArray(Resources.notificationsField).map(t => Notification.fromJson(t.toJson(), t.path))));
  }

  public toJson(): JsonObject {
    return { [Resources.notificationsField]: this.notifications.map(t => t.toJson()) };
  }
}
