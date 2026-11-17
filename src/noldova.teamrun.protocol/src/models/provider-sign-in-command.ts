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

import { Resources } from "../resources.js";

export class ProviderSignInCommand {
  public readonly command: string;
  public readonly environment: Readonly<Record<string, string>>;

  public constructor(command: string, environment: Readonly<Record<string, string>>) {
    ArgumentException.throwIfNullOrWhitespace(command, Resources.commandField);

    this.command = command;
    this.environment = { ...environment };
  }

  public static fromJson(value: unknown, path?: string): ProviderSignInCommand {
    const reader = JsonReader.fromValue(value, path);
    const environment = reader.readObject(Resources.environmentField);
    return new ProviderSignInCommand(reader.readNonBlankString(Resources.commandField),
      Object.fromEntries(Object.keys(environment.toJson()).map(t => [t, environment.readString(t)])));
  }

  public toJson(): JsonObject {
    return { [Resources.commandField]: this.command, [Resources.environmentField]: { ...this.environment } };
  }
}
