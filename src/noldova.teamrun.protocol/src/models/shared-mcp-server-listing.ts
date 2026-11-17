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
import { SharedMcpServer } from "./shared-mcp-server.js";
import { SharedMcpUnavailability } from "./shared-mcp-unavailability.js";
import { SharedMcpVariable } from "./shared-mcp-variable.js";

export class SharedMcpServerListing {
  public readonly server: SharedMcpServer;
  public readonly unavailable: readonly SharedMcpUnavailability[];
  public readonly variables: readonly SharedMcpVariable[];
  public readonly signingIn: boolean;

  public constructor(server: SharedMcpServer, unavailable: readonly SharedMcpUnavailability[], variables: readonly SharedMcpVariable[] = [],
    signingIn: boolean = false) {
    if (new Set(unavailable.map(t => t.providerId)).size !== unavailable.length)
      throw new ArgumentException(Resources.duplicateSharedMcpProvider, Resources.unavailableField);
    if (new Set(variables.map(t => t.variable)).size !== variables.length)
      throw new ArgumentException(Resources.duplicateSharedMcpVariable, Resources.variablesField);

    this.server = server;
    this.unavailable = [...unavailable];
    this.variables = [...variables];
    this.signingIn = signingIn;
  }

  public static fromJson(value: unknown, path?: string): SharedMcpServerListing {
    const reader = JsonReader.fromValue(value, path);
    const server = reader.readObject(Resources.serverField);
    return new SharedMcpServerListing(SharedMcpServer.fromJson(server.toJson(), server.path),
      reader.readObjectArray(Resources.unavailableField).map(t => SharedMcpUnavailability.fromJson(t.toJson(), t.path)),
      reader.hasField(Resources.variablesField) ? reader.readObjectArray(Resources.variablesField).map(t => SharedMcpVariable.fromJson(t.toJson(), t.path)) : [],
      reader.hasField(Resources.signingInField) && reader.readBoolean(Resources.signingInField));
  }

  public toJson(): JsonObject {
    return { [Resources.serverField]: this.server.toJson(), [Resources.unavailableField]: this.unavailable.map(t => t.toJson()),
      [Resources.variablesField]: this.variables.map(t => t.toJson()), [Resources.signingInField]: this.signingIn };
  }
}
