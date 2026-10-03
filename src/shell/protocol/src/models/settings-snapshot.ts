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
import { SettingDefinition } from "./setting-definition.js";
import { SettingEntry } from "./setting-entry.js";

export class SettingsSnapshot {
  private static readonly FIELDS: readonly string[] = [Resources.definitionsField, Resources.entriesField];

  public readonly definitions: readonly SettingDefinition[];
  public readonly entries: readonly SettingEntry[];

  public constructor(definitions: readonly SettingDefinition[], entries: readonly SettingEntry[]) {
    const defined = new Set(definitions.map(t => t.name.text));
    const named = entries.map(t => t.name.text);
    if (defined.size !== definitions.length || new Set(named).size !== named.length || named.some(t => !defined.has(t)))
      throw new ArgumentException(Resources.settingEntriesInvalid, Resources.entriesField);

    this.definitions = [...definitions];
    this.entries = [...entries];
  }

  public static fromJson(value: unknown, path?: string): SettingsSnapshot {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, SettingsSnapshot.FIELDS);
    const definitions = reader.readObjectArray(Resources.definitionsField).map(t => SettingDefinition.fromJson(t.toJson(), t.path));
    const entries = reader.readObjectArray(Resources.entriesField).map(t => SettingEntry.fromJson(t.toJson(), t.path));
    return WireContract.create(reader, () => new SettingsSnapshot(definitions, entries));
  }

  public toJson(): JsonObject {
    return { [Resources.definitionsField]: this.definitions.map(t => t.toJson()), [Resources.entriesField]: this.entries.map(t => t.toJson()) };
  }
}
