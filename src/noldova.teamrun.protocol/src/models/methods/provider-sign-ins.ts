/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class ProviderSignIns {
  public readonly providerIds: readonly string[];

  public constructor(providerIds: readonly string[]) {
    for (const id of providerIds)
      ArgumentException.throwIfNullOrWhitespace(id, Resources.providerIdsField);

    this.providerIds = [...providerIds];
  }

  public static fromJson(value: unknown, path?: string): ProviderSignIns {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderSignIns(reader.readStringArray(Resources.providerIdsField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.providerIdsField]: [...this.providerIds]
    };
  }
}
