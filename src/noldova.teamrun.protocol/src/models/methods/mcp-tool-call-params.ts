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

export class McpToolCallParams {
  public readonly token: string;
  public readonly name: string;
  public readonly arguments: JsonObject;

  public constructor(token: string, name: string, input: JsonObject) {
    ArgumentException.throwIfNullOrWhitespace(token, Resources.tokenField);
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameField);

    this.token = token;
    this.name = name;
    this.arguments = input;
  }

  public static fromJson(value: unknown, path?: string): McpToolCallParams {
    const reader = JsonReader.fromValue(value, path);
    return new McpToolCallParams(reader.readNonBlankString(Resources.tokenField), reader.readNonBlankString(Resources.nameField),
      reader.readObject(Resources.argumentsField).toJson());
  }

  public toJson(): JsonObject {
    return {
      [Resources.tokenField]: this.token,
      [Resources.nameField]: this.name,
      [Resources.argumentsField]: this.arguments
    };
  }
}
