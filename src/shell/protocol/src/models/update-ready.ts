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
import { UpdateProcess } from "./update-process.js";

export class UpdateReady {
  private static readonly FIELDS: readonly string[] = [Resources.problemsField, Resources.processesField];

  public readonly problems: readonly string[];
  public readonly processes: readonly UpdateProcess[];

  public constructor(problems: readonly string[], processes: readonly UpdateProcess[]) {
    for (const problem of problems)
      ArgumentException.throwIfNullOrWhitespace(problem, Resources.problemsField);

    this.problems = [...problems];
    this.processes = [...processes];
  }

  public get isReady(): boolean {
    return this.problems.length === 0;
  }

  public static fromJson(value: unknown, path?: string): UpdateReady {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, UpdateReady.FIELDS);
    return WireContract.create(reader, () => new UpdateReady(
      reader.readStringArray(Resources.problemsField),
      reader.readObjectArray(Resources.processesField).map(t => UpdateProcess.fromJson(t.toJson(), t.path))));
  }

  public toJson(): JsonObject {
    return { [Resources.problemsField]: [...this.problems], [Resources.processesField]: this.processes.map(t => t.toJson()) };
  }
}
