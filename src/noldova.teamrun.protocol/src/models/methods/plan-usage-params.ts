/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class PlanUsageParams {
  public readonly kind: string;
  public readonly providerId: string | null;

  public constructor(kind: string, providerId: string | null) {
    ArgumentException.throwIfNullOrWhitespace(kind, Resources.kindField);
    if (!Object.isNull(providerId))
      ArgumentException.throwIfNullOrWhitespace(providerId, Resources.providerIdField);

    this.kind = kind;
    this.providerId = providerId;
  }

  public static fromJson(value: unknown, path?: string): PlanUsageParams {
    const reader = JsonReader.fromValue(value, path);
    return new PlanUsageParams(reader.readNonBlankString(Resources.kindField), reader.readNullableString(Resources.providerIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind,
      [Resources.providerIdField]: this.providerId
    };
  }
}
