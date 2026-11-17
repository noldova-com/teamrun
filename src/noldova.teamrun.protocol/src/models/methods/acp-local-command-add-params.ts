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

import { Resources } from "../../resources.js";
import { SharedMcpSecret } from "../shared-mcp-secret.js";

export class AcpLocalCommandAddParams {
  public readonly name: string;
  public readonly command: string;
  public readonly arguments: readonly string[];
  public readonly secrets: readonly SharedMcpSecret[];

  public constructor(name: string, command: string, args: readonly string[], secrets: readonly SharedMcpSecret[]) {
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameField);
    ArgumentException.throwIfNullOrWhitespace(command, Resources.commandField);

    this.name = name;
    this.command = command;
    this.arguments = [...args];
    this.secrets = [...secrets];
  }

  public static fromJson(value: unknown, path?: string): AcpLocalCommandAddParams {
    const reader = JsonReader.fromValue(value, path);
    return new AcpLocalCommandAddParams(reader.readNonBlankString(Resources.nameField), reader.readNonBlankString(Resources.commandField),
      reader.readStringArray(Resources.argumentsField), reader.readObjectArray(Resources.secretsField).map(t => SharedMcpSecret.fromJson(t.toJson())));
  }

  public toJson(): JsonObject {
    return { [Resources.nameField]: this.name, [Resources.commandField]: this.command, [Resources.argumentsField]: [...this.arguments],
      [Resources.secretsField]: this.secrets.map(t => t.toJson()) };
  }
}
