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

export class CommandStartParams {
  public readonly senderToken: string;
  public readonly command: string;
  public readonly description: string;

  public constructor(senderToken: string, command: string, description: string) {
    ArgumentException.throwIfNullOrWhitespace(senderToken, Resources.senderTokenField);
    ArgumentException.throwIfNullOrWhitespace(command, Resources.commandField);
    ArgumentException.throwIfNullOrWhitespace(description, Resources.descriptionField);
    if (command.length > Resources.maximumCommandLength)
      throw new ArgumentException(Resources.commandTooLong, Resources.commandField);

    this.senderToken = senderToken;
    this.command = command;
    this.description = description;
  }

  public static fromJson(value: unknown, path?: string): CommandStartParams {
    const reader = JsonReader.fromValue(value, path);
    return new CommandStartParams(reader.readNonBlankString(Resources.senderTokenField), reader.readNonBlankString(Resources.commandField),
      reader.readNonBlankString(Resources.descriptionField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.senderTokenField]: this.senderToken,
      [Resources.commandField]: this.command,
      [Resources.descriptionField]: this.description
    };
  }
}
