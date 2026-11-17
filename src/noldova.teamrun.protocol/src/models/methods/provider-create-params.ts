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

import { Resources } from "../../resources.js";

export class ProviderCreateParams {
  public readonly kind: string;
  public readonly label: string;
  public readonly profileDir: string | null;

  public constructor(kind: string, label: string, profileDir: string | null) {
    ArgumentException.throwIfNullOrWhitespace(kind, Resources.kindField);
    ArgumentException.throwIfNullOrWhitespace(label, Resources.labelField);
    if (!Object.isNull(profileDir))
      ArgumentException.throwIfNullOrWhitespace(profileDir, Resources.profileDirField);

    this.kind = kind;
    this.label = label;
    this.profileDir = profileDir;
  }

  public static fromJson(value: unknown, path?: string): ProviderCreateParams {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderCreateParams(
      reader.readNonBlankString(Resources.kindField),
      reader.readNonBlankString(Resources.labelField),
      Object.isNull(reader.readNullableString(Resources.profileDirField)) ? null : reader.readNonBlankString(Resources.profileDirField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind,
      [Resources.labelField]: this.label,
      [Resources.profileDirField]: this.profileDir
    };
  }
}
