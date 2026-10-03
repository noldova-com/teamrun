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
import { SettingScope } from "./setting-scope.js";

export class SettingKey {
  private static readonly FIELDS: readonly string[] = [Resources.nameField, Resources.scopeField, Resources.deviceField];

  public readonly name: QualifiedName;
  public readonly scope: SettingScope | null;
  public readonly device: string | null;

  public constructor(name: QualifiedName, scope: SettingScope | null = null, device: string | null = null) {
    if (!Object.isNull(device) && String.isNullOrWhitespace(device))
      throw new ArgumentException(Resources.settingDeviceInvalid, Resources.deviceField);

    this.name = name;
    this.scope = scope;
    this.device = device;
  }

  public static fromJson(value: unknown, path?: string): SettingKey {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, SettingKey.FIELDS);
    const scope = reader.hasField(Resources.scopeField) ? SettingScope.fromJson(reader.readObject(Resources.scopeField).toJson(), Resources.formatFieldPath(reader.path, Resources.scopeField)) : null;
    return WireContract.create(reader, () => new SettingKey(
      QualifiedName.parse(reader.readString(Resources.nameField), Resources.nameField),
      scope,
      reader.hasField(Resources.deviceField) ? reader.readString(Resources.deviceField) : null));
  }

  public toJson(): JsonObject {
    return {
      [Resources.nameField]: this.name.text,
      ...Object.isNull(this.scope) ? {} : { [Resources.scopeField]: this.scope.toJson() },
      ...Object.isNull(this.device) ? {} : { [Resources.deviceField]: this.device }
    };
  }
}
