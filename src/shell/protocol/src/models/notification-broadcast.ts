/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { Notification } from "./notification.js";
import { NotificationState } from "./notification-state.js";

export class NotificationBroadcast {
  private static readonly FIELDS: readonly string[] = [Resources.notificationsField, Resources.quietDevicesField, Resources.mutedModulesField, Resources.sequenceField];

  public readonly notifications: readonly Notification[];
  public readonly quietDevices: readonly string[];
  public readonly mutedModules: readonly string[];
  public readonly sequence: number;

  public constructor(notifications: readonly Notification[], quietDevices: readonly string[], mutedModules: readonly string[], sequence: number) {
    if (quietDevices.some(t => String.isNullOrWhitespace(t)))
      throw new ArgumentException(Resources.quietDeviceInvalid, Resources.quietDevicesField);
    if (mutedModules.some(t => String.isNullOrWhitespace(t)))
      throw new ArgumentException(Resources.mutedModuleInvalid, Resources.mutedModulesField);
    if (!Number.isSafeInteger(sequence) || sequence < 0)
      throw new ArgumentException(Resources.currentSequenceInvalid, Resources.sequenceField);

    this.notifications = [...notifications];
    this.quietDevices = [...quietDevices];
    this.mutedModules = [...mutedModules];
    this.sequence = sequence;
  }

  public static fromJson(value: unknown, path?: string): NotificationBroadcast {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, NotificationBroadcast.FIELDS);
    return WireContract.create(reader, () => new NotificationBroadcast(
      reader.readObjectArray(Resources.notificationsField).map(t => Notification.fromJson(t.toJson(), t.path)),
      reader.readStringArray(Resources.quietDevicesField),
      reader.readStringArray(Resources.mutedModulesField),
      reader.readInteger(Resources.sequenceField)));
  }

  public stateFor(device: string): NotificationState {
    return new NotificationState(this.notifications, this.quietDevices.includes(device), this.mutedModules, this.sequence);
  }

  public toJson(): JsonObject {
    return {
      [Resources.notificationsField]: this.notifications.map(t => t.toJson()),
      [Resources.quietDevicesField]: [...this.quietDevices],
      [Resources.mutedModulesField]: [...this.mutedModules],
      [Resources.sequenceField]: this.sequence
    };
  }
}
