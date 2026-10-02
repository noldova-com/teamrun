/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject, type JsonValue } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { QualifiedName } from "./qualified-name.js";

export class CommandRun {
  private static readonly FIELDS: readonly string[] = [Resources.nameField, Resources.argumentsField];

  public readonly name: QualifiedName;
  public readonly commandArguments: JsonValue;

  public constructor(name: QualifiedName, commandArguments: JsonValue) {
    this.name = name;
    this.commandArguments = commandArguments;
  }

  public static fromJson(value: unknown, path?: string): CommandRun {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, CommandRun.FIELDS);
    return WireContract.create(reader, () => new CommandRun(
      QualifiedName.parse(reader.readString(Resources.nameField), Resources.nameField),
      reader.readValue(Resources.argumentsField)));
  }

  public toJson(): JsonObject {
    return { [Resources.nameField]: this.name.text, [Resources.argumentsField]: this.commandArguments };
  }
}
