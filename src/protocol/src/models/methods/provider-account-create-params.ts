/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";

export class ProviderAccountCreateParams {
  public readonly provider: string;
  public readonly label: string;
  public readonly profileDir: string;

  public constructor(provider: string, label: string, profileDir: string) {
    ArgumentException.throwIfNullOrWhitespace(provider, Resources.providerField);
    ArgumentException.throwIfNullOrWhitespace(label, Resources.labelField);
    ArgumentException.throwIfNullOrWhitespace(profileDir, Resources.profileDirField);

    this.provider = provider;
    this.label = label;
    this.profileDir = profileDir;
  }

  public static fromJson(value: unknown, path?: string): ProviderAccountCreateParams {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderAccountCreateParams(
      reader.readNonBlankString(Resources.providerField),
      reader.readNonBlankString(Resources.labelField),
      reader.readNonBlankString(Resources.profileDirField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.providerField]: this.provider,
      [Resources.labelField]: this.label,
      [Resources.profileDirField]: this.profileDir
    };
  }
}
