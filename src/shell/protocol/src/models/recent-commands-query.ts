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

export class RecentCommandsQuery {
  private static readonly FIELDS: readonly string[] = [Resources.deviceField];

  public readonly device: string;

  public constructor(device: string) {
    ArgumentException.throwIfNullOrWhitespace(device, Resources.deviceField);

    this.device = device;
  }

  public static fromJson(value: unknown, path?: string): RecentCommandsQuery {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, RecentCommandsQuery.FIELDS);
    return WireContract.create(reader, () => new RecentCommandsQuery(reader.readString(Resources.deviceField)));
  }

  public toJson(): JsonObject {
    return { [Resources.deviceField]: this.device };
  }
}
