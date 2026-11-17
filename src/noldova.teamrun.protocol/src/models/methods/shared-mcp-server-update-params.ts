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
import { SharedMcpServerDefinition } from "../shared-mcp-server-definition.js";

export class SharedMcpServerUpdateParams {
  public readonly serverId: string;
  public readonly definition: SharedMcpServerDefinition;

  public constructor(serverId: string, definition: SharedMcpServerDefinition) {
    ArgumentException.throwIfNullOrWhitespace(serverId, Resources.serverIdField);

    this.serverId = serverId;
    this.definition = definition;
  }

  public static fromJson(value: unknown, path?: string): SharedMcpServerUpdateParams {
    const reader = JsonReader.fromValue(value, path);
    const definition = reader.readObject(Resources.definitionField);
    return new SharedMcpServerUpdateParams(reader.readNonBlankString(Resources.serverIdField),
      SharedMcpServerDefinition.fromJson(definition.toJson(), definition.path));
  }

  public toJson(): JsonObject {
    return { [Resources.serverIdField]: this.serverId, [Resources.definitionField]: this.definition.toJson() };
  }
}
