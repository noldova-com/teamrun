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

export class AcpAgentEntry {
  public readonly id: string;
  public readonly name: string;
  public readonly version: string;
  public readonly description: string;
  public readonly about: string | null;
  public readonly unavailable: string | null;
  public readonly notChecked: boolean;
  public readonly added: boolean;

  public constructor(id: string, name: string, version: string, description: string, about: string | null, unavailable: string | null, notChecked: boolean, added: boolean) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameField);

    this.id = id;
    this.name = name;
    this.version = version;
    this.description = description;
    this.about = about;
    this.unavailable = unavailable;
    this.notChecked = notChecked;
    this.added = added;
  }

  public static fromJson(value: unknown, path?: string): AcpAgentEntry {
    const reader = JsonReader.fromValue(value, path);
    return new AcpAgentEntry(reader.readNonBlankString(Resources.idField), reader.readNonBlankString(Resources.nameField), reader.readString(Resources.versionField),
      reader.readString(Resources.descriptionField), reader.readNullableString(Resources.aboutField), reader.readNullableString(Resources.unavailableField),
      reader.readBoolean(Resources.notCheckedField), reader.readBoolean(Resources.addedField));
  }

  public toJson(): JsonObject {
    return { [Resources.idField]: this.id, [Resources.nameField]: this.name, [Resources.versionField]: this.version, [Resources.descriptionField]: this.description,
      [Resources.aboutField]: this.about, [Resources.unavailableField]: this.unavailable, [Resources.notCheckedField]: this.notChecked, [Resources.addedField]: this.added };
  }
}
