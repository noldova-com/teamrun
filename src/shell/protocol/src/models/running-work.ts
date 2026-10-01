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

export class RunningWork {
  public readonly descriptions: readonly string[];

  public constructor(descriptions: readonly string[]) {
    ArgumentException.throwIfEmpty(descriptions, Resources.descriptionsField);
    for (const description of descriptions)
      ArgumentException.throwIfNullOrWhitespace(description, Resources.descriptionsField);

    this.descriptions = [...descriptions];
  }

  public static fromJson(value: unknown, path?: string): RunningWork {
    const reader = JsonReader.fromValue(value, path);
    return WireContract.create(reader, () => new RunningWork(reader.readStringArray(Resources.descriptionsField)));
  }

  public toJson(): JsonObject {
    return { [Resources.descriptionsField]: [...this.descriptions] };
  }
}
