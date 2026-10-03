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

export class SettingOption {
  private static readonly FIELDS: readonly string[] = [Resources.valueField, Resources.titleField];

  public readonly value: string;
  public readonly title: string;

  public constructor(value: string, title: string) {
    if (String.isNullOrWhitespace(value) || String.isNullOrWhitespace(title))
      throw new ArgumentException(Resources.settingOptionsInvalid, String.isNullOrWhitespace(value) ? Resources.valueField : Resources.titleField);

    this.value = value;
    this.title = title;
  }

  public static fromJson(value: unknown, path?: string): SettingOption {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, SettingOption.FIELDS);
    return WireContract.create(reader, () => new SettingOption(reader.readString(Resources.valueField), reader.readString(Resources.titleField)));
  }

  public toJson(): JsonObject {
    return { [Resources.valueField]: this.value, [Resources.titleField]: this.title };
  }
}
