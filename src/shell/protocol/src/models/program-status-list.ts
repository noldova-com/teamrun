/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { ProgramStatus } from "./program-status.js";

export class ProgramStatusList {
  private static readonly FIELDS: readonly string[] = [Resources.programsField, Resources.sequenceField];

  public readonly programs: readonly ProgramStatus[];
  public readonly sequence: number;

  public constructor(programs: readonly ProgramStatus[], sequence: number) {
    if (!Number.isSafeInteger(sequence) || sequence < 0)
      throw new ArgumentException(Resources.programSequenceInvalid, Resources.sequenceField);

    this.programs = [...programs];
    this.sequence = sequence;
  }

  public static fromJson(value: unknown, path?: string): ProgramStatusList {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, ProgramStatusList.FIELDS);
    return WireContract.create(reader, () => new ProgramStatusList(
      reader.readObjectArray(Resources.programsField).map(t => ProgramStatus.fromJson(t.toJson(), t.path)),
      reader.readInteger(Resources.sequenceField)));
  }

  public toJson(): JsonObject {
    return { [Resources.programsField]: this.programs.map(t => t.toJson()), [Resources.sequenceField]: this.sequence };
  }
}
