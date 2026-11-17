/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonReader, JsonValue } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class AcpMcpTool {
  public readonly server: string;
  public readonly tool: string;

  public constructor(server: string, tool: string) {
    ArgumentException.throwIfNullOrWhitespace(server, Resources.serverParameterName);
    ArgumentException.throwIfNullOrWhitespace(tool, Resources.toolParameterName);

    this.server = server;
    this.tool = tool;
  }

  public static of(server: JsonValue | undefined, tool: JsonValue | undefined): AcpMcpTool | null {
    return Object.isString(server) && Object.isString(tool) && !String.isNullOrWhitespace(server) && !String.isNullOrWhitespace(tool)
      ? new AcpMcpTool(server, tool) : null;
  }

  public static read(call: JsonReader, path: readonly string[], server: string, tool: string): AcpMcpTool | null {
    try {
      const found = path.reduce<JsonReader | null>((reader, field) => reader?.hasField(field) === true ? reader.readNullableObject(field) : null, call);
      return Object.isNull(found) ? null : AcpMcpTool.of(found.toJson()[server], found.toJson()[tool]);
    }
    catch {
      return null;
    }
  }
}
