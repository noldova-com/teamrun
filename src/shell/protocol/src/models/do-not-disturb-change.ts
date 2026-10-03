/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class DoNotDisturbChange {
  private static readonly FIELDS: readonly string[] = [Resources.deviceField, Resources.isOnField];

  public readonly device: string;
  public readonly isOn: boolean;

  public constructor(device: string, isOn: boolean) {
    ArgumentException.throwIfNullOrWhitespace(device, Resources.deviceField);

    this.device = device;
    this.isOn = isOn;
  }

  public static fromJson(value: unknown, path?: string): DoNotDisturbChange {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, DoNotDisturbChange.FIELDS);
    return WireContract.create(reader, () => new DoNotDisturbChange(reader.readString(Resources.deviceField), reader.readBoolean(Resources.isOnField)));
  }

  public toJson(): JsonObject {
    return { [Resources.deviceField]: this.device, [Resources.isOnField]: this.isOn };
  }
}
