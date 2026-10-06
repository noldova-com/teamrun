/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader, JsonValue } from "@noldova/teamrun-foundation-json";

import { CliOptionType } from "../enums/cli-option-type.js";
import { Resources } from "../resources.js";

export class CliOptionDefinition {
  public readonly name: string;
  public readonly description: string;
  public readonly type: CliOptionType;
  public readonly isRequired: boolean;
  public readonly isRepeated: boolean;
  public readonly defaultValue: JsonValue;

  public constructor(name: string, description: string, type: CliOptionType, isRequired: boolean, isRepeated: boolean, defaultValue: JsonValue) {
    this.name = name;
    this.description = description;
    this.type = type;
    this.isRequired = isRequired;
    this.isRepeated = isRepeated;
    this.defaultValue = defaultValue;
  }

  public static fromJson(reader: JsonReader): CliOptionDefinition {
    return new CliOptionDefinition(
      reader.readNonBlankString("name"),
      reader.readNonBlankString("description"),
      reader.readOneOf("type", Object.values(CliOptionType)),
      reader.readBoolean("required"),
      reader.readBoolean("repeated"),
      reader.readValue("default"));
  }

  public get flag(): string {
    return `${Resources.flagPrefix}${Resources.formatWord(this.name)}`;
  }
}
