/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { CommandInfo } from "./command-info.js";

export class CommandList {
  public readonly commands: readonly CommandInfo[];
  public readonly sequence: number;

  public constructor(commands: readonly CommandInfo[], sequence: number) {
    if (!Number.isSafeInteger(sequence) || sequence < 0)
      throw new ArgumentException(Resources.commandSequenceInvalid, Resources.sequenceField);

    this.commands = [...commands];
    this.sequence = sequence;
  }

  public static fromJson(value: unknown, path?: string): CommandList {
    const reader = JsonReader.fromValue(value, path);
    return WireContract.create(reader, () => new CommandList(
      reader.readObjectArray(Resources.commandsField).map(t => CommandInfo.fromJson(t.toJson(), t.path)),
      reader.readInteger(Resources.sequenceField)));
  }

  public toJson(): JsonObject {
    return { [Resources.commandsField]: this.commands.map(t => t.toJson()), [Resources.sequenceField]: this.sequence };
  }
}
