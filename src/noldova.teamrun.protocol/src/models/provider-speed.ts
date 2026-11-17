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

export class ProviderSpeed {
  public readonly id: string;
  public readonly name: string | null;
  public readonly description: string | null;

  public constructor(id: string, name: string | null = null, description: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    if (!Object.isNull(name))
      ArgumentException.throwIfNullOrWhitespace(name, Resources.nameField);
    if (!Object.isNull(description))
      ArgumentException.throwIfNullOrWhitespace(description, Resources.descriptionField);

    this.id = id;
    this.name = name;
    this.description = description;
  }

  public static fromJson(value: unknown, path?: string): ProviderSpeed {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderSpeed(reader.readNonBlankString(Resources.idField), reader.readNullableString(Resources.nameField),
      reader.readNullableString(Resources.descriptionField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.nameField]: this.name,
      [Resources.descriptionField]: this.description
    };
  }
}
