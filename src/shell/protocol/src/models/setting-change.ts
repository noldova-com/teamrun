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

export class SettingChange {
  public readonly key: SettingKey;
  public readonly value: JsonValue;
  public readonly isSet: boolean;

  public constructor(key: SettingKey, value: JsonValue, isSet: boolean) {
    this.key = key;
    this.value = value;
    this.isSet = isSet;
  }

  public static fromJson(value: unknown, path?: string): SettingChange {
    const reader = JsonReader.fromValue(value, path);
    const changed = reader.readValue(Resources.valueField);
    const isSet = reader.readBoolean(Resources.isSetField);
    const key = Object.fromEntries(Object.entries(reader.toJson()).filter(([name]) => name !== Resources.valueField && name !== Resources.isSetField));
    return new SettingChange(SettingKey.fromJson(key, reader.path), changed, isSet);
  }

  public toJson(): JsonObject {
    return { ...this.key.toJson(), [Resources.valueField]: this.value, [Resources.isSetField]: this.isSet };
  }
}
