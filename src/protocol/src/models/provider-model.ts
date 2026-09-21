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

export class ProviderModel {
  public readonly id: string;
  public readonly displayName: string;
  public readonly description: string;
  public readonly effortLevels: readonly string[] | null;
  public readonly isDefault: boolean;
  public readonly resolvedModel: string | null;
  public readonly supportsImages: boolean | null;

  public constructor(id: string, displayName: string, description: string, effortLevels: readonly string[] | null,
    isDefault: boolean, resolvedModel: string | null, supportsImages: boolean | null) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(displayName, Resources.displayNameField);
    for (const effort of effortLevels ?? [])
      ArgumentException.throwIfNullOrWhitespace(effort, Resources.effortLevelsField);

    this.id = id;
    this.displayName = displayName;
    this.description = description;
    this.effortLevels = Object.isNull(effortLevels) ? null : [...effortLevels];
    this.isDefault = isDefault;
    this.resolvedModel = resolvedModel;
    this.supportsImages = supportsImages;
  }

  public static fromJson(value: unknown, path?: string): ProviderModel {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderModel(reader.readNonBlankString(Resources.idField), reader.readNonBlankString(Resources.displayNameField),
      reader.readString(Resources.descriptionField),
      Object.isNull(reader.toJson()[Resources.effortLevelsField]) ? null : reader.readStringArray(Resources.effortLevelsField),
      reader.readBoolean(Resources.isDefaultField), reader.readNullableString(Resources.resolvedModelField),
      Object.isNull(reader.toJson()[Resources.supportsImagesField]) ? null : reader.readBoolean(Resources.supportsImagesField));
  }

  public matches(id: string | null): boolean {
    return Object.isNull(id) ? this.isDefault : id === this.id || id === this.resolvedModel;
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.displayNameField]: this.displayName,
      [Resources.descriptionField]: this.description,
      [Resources.effortLevelsField]: Object.isNull(this.effortLevels) ? null : [...this.effortLevels],
      [Resources.isDefaultField]: this.isDefault,
      [Resources.resolvedModelField]: this.resolvedModel,
      [Resources.supportsImagesField]: this.supportsImages
    };
  }
}
