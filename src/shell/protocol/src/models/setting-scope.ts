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
import { QualifiedName } from "./qualified-name.js";

export class SettingScope {
  private static readonly FIELDS: readonly string[] = [Resources.nameField, Resources.idField];

  public readonly name: QualifiedName;
  public readonly id: string;

  public constructor(name: QualifiedName, id: string) {
    if (String.isNullOrWhitespace(id))
      throw new ArgumentException(Resources.settingScopeIdInvalid, Resources.idField);

    this.name = name;
    this.id = id;
  }

  public static fromJson(value: unknown, path?: string): SettingScope {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, SettingScope.FIELDS);
    return WireContract.create(reader, () => new SettingScope(QualifiedName.parse(reader.readString(Resources.nameField), Resources.nameField), reader.readString(Resources.idField)));
  }

  public equals(other: SettingScope | null): boolean {
    return !Object.isNull(other) && other.name.text === this.name.text && other.id === this.id;
  }

  public toJson(): JsonObject {
    return { [Resources.nameField]: this.name.text, [Resources.idField]: this.id };
  }
}
