/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject, type JsonValue } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { QualifiedName } from "./qualified-name.js";

export class SettingEntry {
  private static readonly FIELDS: readonly string[] = [Resources.nameField, Resources.valueField, Resources.isSetField];

  public readonly name: QualifiedName;
  public readonly value: JsonValue;
  public readonly isSet: boolean;

  public constructor(name: QualifiedName, value: JsonValue, isSet: boolean) {
    this.name = name;
    this.value = value;
    this.isSet = isSet;
  }

  public static fromJson(value: unknown, path?: string): SettingEntry {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, SettingEntry.FIELDS);
    return WireContract.create(reader, () => new SettingEntry(
      QualifiedName.parse(reader.readString(Resources.nameField), Resources.nameField),
      reader.readValue(Resources.valueField),
      reader.readBoolean(Resources.isSetField)));
  }

  public toJson(): JsonObject {
    return { [Resources.nameField]: this.name.text, [Resources.valueField]: this.value, [Resources.isSetField]: this.isSet };
  }
}
