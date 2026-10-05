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

export class RecentCommandUse {
  private static readonly FIELDS: readonly string[] = [Resources.deviceField, Resources.idField];

  public readonly device: string;
  public readonly id: string;

  public constructor(device: string, id: string) {
    ArgumentException.throwIfNullOrWhitespace(device, Resources.deviceField);
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);

    this.device = device;
    this.id = id;
  }

  public static fromJson(value: unknown, path?: string): RecentCommandUse {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, RecentCommandUse.FIELDS);
    return WireContract.create(reader, () => new RecentCommandUse(reader.readString(Resources.deviceField), reader.readString(Resources.idField)));
  }

  public toJson(): JsonObject {
    return { [Resources.deviceField]: this.device, [Resources.idField]: this.id };
  }
}
