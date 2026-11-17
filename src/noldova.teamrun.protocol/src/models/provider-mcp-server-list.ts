/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { OwnMcpServer } from "./own-mcp-server.js";

export class ProviderMcpServerList {
  public readonly providerId: string;
  public readonly servers: readonly OwnMcpServer[] | null;

  public constructor(providerId: string, servers: readonly OwnMcpServer[] | null) {
    ArgumentException.throwIfNullOrWhitespace(providerId, Resources.providerIdField);

    this.providerId = providerId;
    this.servers = Object.isNull(servers) ? null : [...servers];
  }

  public static fromJson(value: unknown, path?: string): ProviderMcpServerList {
    const reader = JsonReader.fromValue(value, path);
    const providerId = reader.readNonBlankString(Resources.providerIdField);
    return new ProviderMcpServerList(providerId, reader.readValue(Resources.serversField) === null ? null
      : reader.readObjectArray(Resources.serversField).map(t => OwnMcpServer.fromJson(t.toJson(), t.path)));
  }

  public toJson(): JsonObject {
    return {
      [Resources.providerIdField]: this.providerId,
      [Resources.serversField]: Object.isNull(this.servers) ? null : this.servers.map(t => t.toJson())
    };
  }
}
