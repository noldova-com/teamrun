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

export class ProviderTool {
  public readonly kind: string;
  public readonly found: boolean;
  public readonly version: string | null;
  public readonly installCommand: string | null;
  public readonly subscribeUrl: string | null;

  public constructor(kind: string, found: boolean, version: string | null = null, installCommand: string | null = null, subscribeUrl: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(kind, Resources.kindField);
    if (!Object.isNull(version))
      ArgumentException.throwIfNullOrWhitespace(version, Resources.versionField);
    if (!Object.isNull(installCommand))
      ArgumentException.throwIfNullOrWhitespace(installCommand, Resources.installCommandField);
    if (!Object.isNull(subscribeUrl))
      ArgumentException.throwIfNullOrWhitespace(subscribeUrl, Resources.subscribeUrlField);

    this.kind = kind;
    this.found = found;
    this.version = version;
    this.installCommand = installCommand;
    this.subscribeUrl = subscribeUrl;
  }

  public static fromJson(value: unknown, path?: string): ProviderTool {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderTool(
      reader.readNonBlankString(Resources.kindField),
      reader.readBoolean(Resources.foundField),
      reader.readNullableString(Resources.versionField),
      reader.readNullableString(Resources.installCommandField),
      reader.readNullableString(Resources.subscribeUrlField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind,
      [Resources.foundField]: this.found,
      [Resources.versionField]: this.version,
      [Resources.installCommandField]: this.installCommand,
      [Resources.subscribeUrlField]: this.subscribeUrl
    };
  }
}
