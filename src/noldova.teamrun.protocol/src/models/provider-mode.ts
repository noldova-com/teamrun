/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class ProviderMode {
  public readonly id: string;
  public readonly name: string;
  public readonly description: string | null;
  public readonly unrestricted: boolean;
  public readonly readOnly: boolean;

  public constructor(id: string, name: string, description: string | null = null, unrestricted: boolean = false, readOnly: boolean = false) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameField);
    if (!Object.isNull(description))
      ArgumentException.throwIfNullOrWhitespace(description, Resources.descriptionField);

    this.id = id;
    this.name = name;
    this.description = description;
    this.unrestricted = unrestricted;
    this.readOnly = readOnly;
  }

  public static fromJson(value: unknown, path?: string): ProviderMode {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderMode(reader.readNonBlankString(Resources.idField), reader.readNonBlankString(Resources.nameField),
      reader.readNullableString(Resources.descriptionField), reader.readBoolean(Resources.unrestrictedField), reader.readBoolean(Resources.readOnlyField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.nameField]: this.name,
      [Resources.descriptionField]: this.description,
      [Resources.unrestrictedField]: this.unrestricted,
      [Resources.readOnlyField]: this.readOnly
    };
  }
}
