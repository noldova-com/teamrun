/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class CliArgumentDefinition {
  public readonly name: string;
  public readonly description: string;
  public readonly isRequired: boolean;
  public readonly isVariadic: boolean;

  public constructor(name: string, description: string, isRequired: boolean, isVariadic: boolean) {
    this.name = name;
    this.description = description;
    this.isRequired = isRequired;
    this.isVariadic = isVariadic;
  }

  public static fromJson(reader: JsonReader): CliArgumentDefinition {
    return new CliArgumentDefinition(reader.readNonBlankString("name"), reader.readNonBlankString("description"), reader.readBoolean("required"), reader.readBoolean("variadic"));
  }

  public get placeholder(): string {
    return `<${Resources.formatWord(this.name)}>`;
  }
}
