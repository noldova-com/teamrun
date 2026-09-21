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

export class ProviderDescriptor {
  public readonly id: string;
  public readonly displayName: string;
  public readonly effortLevels: readonly string[];
  public readonly supportsResume: boolean;
  public readonly supportsSignInCheck: boolean;
  public readonly supportsFork: boolean;

  public constructor(
    id: string,
    displayName: string,
    effortLevels: readonly string[],
    supportsResume: boolean,
    supportsSignInCheck: boolean,
    supportsFork: boolean = false) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(displayName, Resources.displayNameField);

    this.id = id;
    this.displayName = displayName;
    this.effortLevels = [...effortLevels];
    this.supportsResume = supportsResume;
    this.supportsSignInCheck = supportsSignInCheck;
    this.supportsFork = supportsFork;
  }

  public static fromJson(value: unknown, path?: string): ProviderDescriptor {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderDescriptor(
      reader.readNonBlankString(Resources.idField),
      reader.readNonBlankString(Resources.displayNameField),
      reader.readStringArray(Resources.effortLevelsField),
      reader.readBoolean(Resources.supportsResumeField),
      reader.readBoolean(Resources.supportsSignInCheckField),
      reader.hasField(Resources.supportsForkField) ? reader.readBoolean(Resources.supportsForkField) : false);
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.displayNameField]: this.displayName,
      [Resources.effortLevelsField]: this.effortLevels,
      [Resources.supportsResumeField]: this.supportsResume,
      [Resources.supportsSignInCheckField]: this.supportsSignInCheck,
      [Resources.supportsForkField]: this.supportsFork
    };
  }
}
