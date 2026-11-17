/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { OwnMcpServerState } from "../enums/own-mcp-server-state.js";
import { Resources } from "../resources.js";

export class OwnMcpServer {
  public readonly name: string;
  public readonly state: OwnMcpServerState;

  public constructor(name: string, state: OwnMcpServerState) {
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameField);

    this.name = name;
    this.state = state;
  }

  public static fromJson(value: unknown, path?: string): OwnMcpServer {
    const reader = JsonReader.fromValue(value, path);
    return new OwnMcpServer(reader.readNonBlankString(Resources.nameField), reader.readOneOf(Resources.stateField, Object.values(OwnMcpServerState)));
  }

  public toJson(): JsonObject {
    return {
      [Resources.nameField]: this.name,
      [Resources.stateField]: this.state
    };
  }
}
