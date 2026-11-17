/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class ProviderUpdateParams {
  public readonly providerId: string;
  public readonly label: string;
  public readonly profileDir: string;
  public readonly ownMcpServers: boolean | null;
  public readonly binaryPath: string | null;

  public constructor(providerId: string, label: string, profileDir: string, ownMcpServers: boolean | null = null,
    binaryPath: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(providerId, Resources.providerIdField);
    ArgumentException.throwIfNullOrWhitespace(label, Resources.labelField);
    ArgumentException.throwIfNullOrWhitespace(profileDir, Resources.profileDirField);

    this.providerId = providerId;
    this.label = label;
    this.profileDir = profileDir;
    this.ownMcpServers = ownMcpServers;
    this.binaryPath = binaryPath;
  }

  public static fromJson(value: unknown, path?: string): ProviderUpdateParams {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderUpdateParams(
      reader.readNonBlankString(Resources.providerIdField),
      reader.readNonBlankString(Resources.labelField),
      reader.readNonBlankString(Resources.profileDirField),
      reader.hasField(Resources.ownMcpServersField) ? reader.readBoolean(Resources.ownMcpServersField) : null,
      reader.hasField(Resources.binaryPathField) ? reader.readString(Resources.binaryPathField) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.providerIdField]: this.providerId,
      [Resources.labelField]: this.label,
      [Resources.profileDirField]: this.profileDir,
      ...Object.isNull(this.ownMcpServers) ? {} : { [Resources.ownMcpServersField]: this.ownMcpServers },
      ...Object.isNull(this.binaryPath) ? {} : { [Resources.binaryPathField]: this.binaryPath }
    };
  }
}
