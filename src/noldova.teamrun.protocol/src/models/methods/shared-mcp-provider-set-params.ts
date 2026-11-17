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

export class SharedMcpProviderSetParams {
  public readonly serverId: string;
  public readonly providerId: string;
  public readonly on: boolean;

  public constructor(serverId: string, providerId: string, on: boolean) {
    ArgumentException.throwIfNullOrWhitespace(serverId, Resources.serverIdField);
    ArgumentException.throwIfNullOrWhitespace(providerId, Resources.providerIdField);

    this.serverId = serverId;
    this.providerId = providerId;
    this.on = on;
  }

  public static fromJson(value: unknown, path?: string): SharedMcpProviderSetParams {
    const reader = JsonReader.fromValue(value, path);
    return new SharedMcpProviderSetParams(reader.readNonBlankString(Resources.serverIdField), reader.readNonBlankString(Resources.providerIdField),
      reader.readBoolean(Resources.onField));
  }

  public toJson(): JsonObject {
    return { [Resources.serverIdField]: this.serverId, [Resources.providerIdField]: this.providerId, [Resources.onField]: this.on };
  }
}
