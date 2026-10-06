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

export class ProgramStatus {
  private static readonly FIELDS: readonly string[] = [Resources.moduleField, Resources.programField, Resources.processIdField, Resources.startedAtField, Resources.hasExitedField];

  public readonly moduleId: string;
  public readonly program: string;
  public readonly processId: number;
  public readonly started: Date;
  public readonly hasExited: boolean;

  public constructor(moduleId: string, program: string, processId: number, started: Date, hasExited: boolean) {
    ArgumentException.throwIfNullOrWhitespace(moduleId, Resources.moduleField);
    ArgumentException.throwIfNullOrWhitespace(program, Resources.programField);
    if (!Number.isSafeInteger(processId) || processId < 1)
      throw new ArgumentException(Resources.processIdInvalid, Resources.processIdField);
    if (Number.isNaN(started.getTime()))
      throw new ArgumentException(Resources.programStartInvalid, Resources.startedAtField);

    this.moduleId = moduleId;
    this.program = program;
    this.processId = processId;
    this.started = new Date(started.getTime());
    this.hasExited = hasExited;
  }

  public static fromJson(value: unknown, path?: string): ProgramStatus {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, ProgramStatus.FIELDS);
    return WireContract.create(reader, () => new ProgramStatus(
      reader.readString(Resources.moduleField),
      reader.readString(Resources.programField),
      reader.readInteger(Resources.processIdField),
      new Date(reader.readString(Resources.startedAtField)),
      reader.readBoolean(Resources.hasExitedField)));
  }

  public toJson(): JsonObject {
    return {
      [Resources.moduleField]: this.moduleId,
      [Resources.programField]: this.program,
      [Resources.processIdField]: this.processId,
      [Resources.startedAtField]: this.started.toISOString(),
      [Resources.hasExitedField]: this.hasExited
    };
  }
}
