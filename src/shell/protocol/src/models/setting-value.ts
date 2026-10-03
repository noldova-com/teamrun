/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject, type JsonValue } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { SettingKey } from "./setting-key.js";

export class SettingValue {
  public readonly key: SettingKey;
  public readonly value: JsonValue;

  public constructor(key: SettingKey, value: JsonValue) {
    this.key = key;
    this.value = value;
  }

  public static fromJson(value: unknown, path?: string): SettingValue {
    const reader = JsonReader.fromValue(value, path);
    const written = reader.readValue(Resources.valueField);
    const key = Object.fromEntries(Object.entries(reader.toJson()).filter(([name]) => name !== Resources.valueField));
    return new SettingValue(SettingKey.fromJson(key, reader.path), written);
  }

  public toJson(): JsonObject {
    return { ...this.key.toJson(), [Resources.valueField]: this.value };
  }
}
