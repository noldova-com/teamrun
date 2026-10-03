/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/teamrun-foundation-json";

import { SettingLocality } from "../enums/setting-locality.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { QualifiedName } from "./qualified-name.js";
import { SettingType } from "./setting-type.js";

export class SettingDefinition {
  private static readonly FIELDS: readonly string[] = [
    Resources.nameField, Resources.titleField, Resources.descriptionField, Resources.typeField, Resources.defaultField,
    Resources.localityField, Resources.scopesField, Resources.pageField, Resources.groupField
  ];

  public readonly name: QualifiedName;
  public readonly title: string;
  public readonly description: string;
  public readonly type: SettingType;
  public readonly defaultValue: JsonValue;
  public readonly locality: SettingLocality;
  public readonly scopes: readonly QualifiedName[];
  public readonly page: string;
  public readonly group: string;

  public constructor(
    name: QualifiedName,
    title: string,
    description: string,
    type: SettingType,
    defaultValue: JsonValue,
    locality: SettingLocality,
    scopes: readonly QualifiedName[],
    page: string,
    group: string
  ) {
    const blank = [[title, Resources.titleField], [description, Resources.descriptionField], [page, Resources.pageField], [group, Resources.groupField]].find(([text]) => String.isNullOrWhitespace(text));
    if (!Object.isUndefined(blank))
      throw new ArgumentException(Resources.settingTextInvalid, blank[1]);
    if (!type.accepts(defaultValue))
      throw new ArgumentException(Resources.settingDefaultInvalid, Resources.defaultField);
    if (new Set(scopes.map(t => t.text)).size !== scopes.length || (locality === SettingLocality.Device && scopes.length > 0))
      throw new ArgumentException(Resources.settingScopesInvalid, Resources.scopesField);

    this.name = name;
    this.title = title;
    this.description = description;
    this.type = type;
    this.defaultValue = defaultValue;
    this.locality = locality;
    this.scopes = [...scopes];
    this.page = page;
    this.group = group;
  }

  public static fromJson(value: unknown, path?: string): SettingDefinition {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, SettingDefinition.FIELDS);
    const type = SettingType.fromJson(reader.readObject(Resources.typeField).toJson(), Resources.formatFieldPath(reader.path, Resources.typeField));
    return WireContract.create(reader, () => new SettingDefinition(
      QualifiedName.parse(reader.readString(Resources.nameField), Resources.nameField),
      reader.readString(Resources.titleField),
      reader.readString(Resources.descriptionField),
      type,
      reader.readValue(Resources.defaultField),
      reader.readOneOf(Resources.localityField, Object.values(SettingLocality)),
      reader.readStringArray(Resources.scopesField).map(t => QualifiedName.parse(t, Resources.scopesField)),
      reader.readString(Resources.pageField),
      reader.readString(Resources.groupField)));
  }

  public isScopedBy(scope: QualifiedName): boolean {
    return this.scopes.some(t => t.text === scope.text);
  }

  public toJson(): JsonObject {
    return {
      [Resources.nameField]: this.name.text,
      [Resources.titleField]: this.title,
      [Resources.descriptionField]: this.description,
      [Resources.typeField]: this.type.toJson(),
      [Resources.defaultField]: this.defaultValue,
      [Resources.localityField]: this.locality,
      [Resources.scopesField]: this.scopes.map(t => t.text),
      [Resources.pageField]: this.page,
      [Resources.groupField]: this.group
    };
  }
}
