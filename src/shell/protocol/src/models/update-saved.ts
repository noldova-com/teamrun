/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class UpdateSaved {
  private static readonly FIELDS: readonly string[] = [Resources.processIdField, Resources.problemsField];

  public readonly processId: number;
  public readonly problems: readonly string[];

  public constructor(processId: number, problems: readonly string[]) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(processId, Resources.processIdField);
    for (const problem of problems)
      ArgumentException.throwIfNullOrWhitespace(problem, Resources.problemsField);

    this.processId = processId;
    this.problems = [...problems];
  }

  public static fromJson(value: unknown, path?: string): UpdateSaved {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, UpdateSaved.FIELDS);
    return WireContract.create(reader, () => new UpdateSaved(reader.readInteger(Resources.processIdField), reader.readStringArray(Resources.problemsField)));
  }

  public toJson(): JsonObject {
    return { [Resources.processIdField]: this.processId, [Resources.problemsField]: [...this.problems] };
  }
}
