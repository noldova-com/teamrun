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

export class ProviderProfileDiscoverParams {
  public readonly kinds: readonly string[] | null;

  public constructor(kinds: readonly string[] | null = null) {
    for (const kind of kinds ?? [])
      ArgumentException.throwIfNullOrWhitespace(kind, Resources.kindsField);

    this.kinds = Object.isNull(kinds) ? null : [...kinds];
  }

  public static fromJson(value: unknown, path?: string): ProviderProfileDiscoverParams {
    if (Object.isNull(value))
      return new ProviderProfileDiscoverParams();
    const reader = JsonReader.fromValue(value, path);
    return new ProviderProfileDiscoverParams(Object.isNull(reader.toJson()[Resources.kindsField] ?? null) ? null : reader.readStringArray(Resources.kindsField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindsField]: Object.isNull(this.kinds) ? null : [...this.kinds]
    };
  }
}
