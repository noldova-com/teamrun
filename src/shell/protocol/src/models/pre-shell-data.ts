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

export class PreShellData {
  private static readonly FIELDS: readonly string[] = [Resources.locationField];

  public readonly location: string;

  public constructor(location: string) {
    ArgumentException.throwIfNullOrWhitespace(location, Resources.locationField);

    this.location = location;
  }

  public static fromJson(value: unknown, path?: string): PreShellData {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, PreShellData.FIELDS);
    return WireContract.create(reader, () => new PreShellData(reader.readString(Resources.locationField)));
  }

  public toJson(): JsonObject {
    return { [Resources.locationField]: this.location };
  }
}
