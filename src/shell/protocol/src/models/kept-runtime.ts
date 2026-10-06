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

export class KeptRuntime {
  private static readonly FIELDS: readonly string[] = [Resources.keptForField];

  public readonly keptFor: number;

  public constructor(keptFor: number) {
    if (!Number.isSafeInteger(keptFor) || keptFor < 1)
      throw new ArgumentException(Resources.keptForInvalid, Resources.keptForField);

    this.keptFor = keptFor;
  }

  public static fromJson(value: unknown, path?: string): KeptRuntime {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, KeptRuntime.FIELDS);
    return WireContract.create(reader, () => new KeptRuntime(reader.readInteger(Resources.keptForField)));
  }

  public toJson(): JsonObject {
    return { [Resources.keptForField]: this.keptFor };
  }
}
