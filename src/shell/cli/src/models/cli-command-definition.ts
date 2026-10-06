/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { CliArgumentDefinition } from "./cli-argument-definition.js";
import { CliOptionDefinition } from "./cli-option-definition.js";

export class CliCommandDefinition {
  public readonly name: string;
  public readonly summary: string;
  public readonly description: string | null;
  public readonly arguments: readonly CliArgumentDefinition[];
  public readonly options: readonly CliOptionDefinition[];
  public readonly examples: readonly (readonly [string, string])[];

  public constructor(
    name: string,
    summary: string,
    description: string | null,
    commandArguments: readonly CliArgumentDefinition[],
    options: readonly CliOptionDefinition[],
    examples: readonly (readonly [string, string])[]) {
    this.name = name;
    this.summary = summary;
    this.description = description;
    this.arguments = commandArguments;
    this.options = options;
    this.examples = examples;
  }

  public static fromJson(reader: JsonReader): CliCommandDefinition {
    return new CliCommandDefinition(
      reader.readNonBlankString("name"),
      reader.readNonBlankString("summary"),
      reader.readNullableString("description"),
      reader.readObjectArray("arguments").map(t => CliArgumentDefinition.fromJson(t)),
      reader.readObjectArray("options").map(t => CliOptionDefinition.fromJson(t)),
      reader.readObjectArray("examples").map(t => [t.readString("arguments"), t.readNonBlankString("description")] as const));
  }

  public get word(): string {
    return Resources.formatWord(this.name.slice(this.name.indexOf(Resources.nameSeparator) + 1));
  }
}
