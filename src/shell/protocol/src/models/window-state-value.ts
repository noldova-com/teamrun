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

export class WindowStateValue {
  private static readonly FIELDS: readonly string[] = [Resources.valueField];

  public readonly value: JsonObject | null;

  public constructor(value: JsonObject | null) {
    this.value = value;
  }

  public static fromJson(value: unknown, path?: string): WindowStateValue {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, WindowStateValue.FIELDS);
    return new WindowStateValue(reader.readNullableObject(Resources.valueField)?.toJson() ?? null);
  }

  public toJson(): JsonObject {
    return { [Resources.valueField]: this.value };
  }
}
