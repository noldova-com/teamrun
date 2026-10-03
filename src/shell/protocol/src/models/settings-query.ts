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

export class SettingsQuery {
  private static readonly FIELDS: readonly string[] = [Resources.deviceField];

  public readonly device: string | null;

  public constructor(device: string | null) {
    if (!Object.isNull(device) && String.isNullOrWhitespace(device))
      throw new ArgumentException(Resources.settingDeviceInvalid, Resources.deviceField);

    this.device = device;
  }

  public static fromJson(value: unknown, path?: string): SettingsQuery {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, SettingsQuery.FIELDS);
    return WireContract.create(reader, () => new SettingsQuery(reader.hasField(Resources.deviceField) ? reader.readString(Resources.deviceField) : null));
  }

  public toJson(): JsonObject {
    return Object.isNull(this.device) ? {} : { [Resources.deviceField]: this.device };
  }
}
