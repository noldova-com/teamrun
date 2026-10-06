/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader } from "@noldova/teamrun-foundation-json";

import { CliCommandDefinition } from "./cli-command-definition.js";

export class CliModule {
  public readonly id: string;
  public readonly displayName: string;
  public readonly description: string;
  public readonly dependencies: readonly string[];
  public readonly cliPackage: string | null;
  public readonly commands: readonly CliCommandDefinition[];

  public constructor(id: string, displayName: string, description: string, dependencies: readonly string[], cliPackage: string | null, commands: readonly CliCommandDefinition[]) {
    this.id = id;
    this.displayName = displayName;
    this.description = description;
    this.dependencies = dependencies;
    this.cliPackage = cliPackage;
    this.commands = commands;
  }

  public static fromJson(reader: JsonReader): CliModule {
    return new CliModule(
      reader.readNonBlankString("id"),
      reader.readNonBlankString("displayName"),
      reader.readNonBlankString("description"),
      reader.readStringArray("dependencies"),
      reader.readNullableString("cliPackage"),
      reader.readObjectArray("cliCommands").map(t => CliCommandDefinition.fromJson(t)));
  }
}
