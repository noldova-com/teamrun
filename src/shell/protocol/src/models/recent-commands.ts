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

export class RecentCommands {
  private static readonly FIELDS: readonly string[] = [Resources.idsField, Resources.deviceField];

  public readonly ids: readonly string[];
  public readonly device: string | null;

  public constructor(ids: readonly string[], device: string | null = null) {
    if (ids.some(t => String.isNullOrWhitespace(t)))
      throw new ArgumentException(Resources.recentCommandInvalid, Resources.idsField);
    if (new Set(ids).size !== ids.length)
      throw new ArgumentException(Resources.recentCommandRepeated, Resources.idsField);
    if (!Object.isNull(device))
      ArgumentException.throwIfNullOrWhitespace(device, Resources.deviceField);

    this.ids = [...ids];
    this.device = device;
  }

  public static fromJson(value: unknown, path?: string): RecentCommands {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, RecentCommands.FIELDS);
    return WireContract.create(reader, () => new RecentCommands(
      reader.readStringArray(Resources.idsField),
      reader.hasField(Resources.deviceField) ? reader.readString(Resources.deviceField) : null));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idsField]: [...this.ids],
      ...Object.isNull(this.device) ? {} : { [Resources.deviceField]: this.device }
    };
  }
}
