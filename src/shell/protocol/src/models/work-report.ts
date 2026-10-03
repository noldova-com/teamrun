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

export class WorkReport {
  public readonly descriptions: readonly string[];
  public readonly sequence: number;

  public constructor(descriptions: readonly string[], sequence: number = 0) {
    for (const description of descriptions)
      ArgumentException.throwIfNullOrWhitespace(description, Resources.descriptionsField);
    if (!Number.isSafeInteger(sequence) || sequence < 0)
      throw new ArgumentException(Resources.workSequenceInvalid, Resources.sequenceField);

    this.descriptions = [...descriptions];
    this.sequence = sequence;
  }

  public static fromJson(value: unknown, path?: string): WorkReport {
    const reader = JsonReader.fromValue(value, path);
    return WireContract.create(reader, () => new WorkReport(reader.readStringArray(Resources.descriptionsField), reader.readInteger(Resources.sequenceField)));
  }

  public isNewerThan(other: WorkReport | null): boolean {
    return Object.isNull(other) || this.sequence > other.sequence;
  }

  public toJson(): JsonObject {
    return { [Resources.descriptionsField]: [...this.descriptions], [Resources.sequenceField]: this.sequence };
  }
}
