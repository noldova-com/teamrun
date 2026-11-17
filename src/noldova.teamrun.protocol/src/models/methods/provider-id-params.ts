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

export class ProviderIdParams {
  public readonly providerId: string;

  public constructor(providerId: string) {
    ArgumentException.throwIfNullOrWhitespace(providerId, Resources.providerIdField);

    this.providerId = providerId;
  }

  public static fromJson(value: unknown, path?: string): ProviderIdParams {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderIdParams(reader.readNonBlankString(Resources.providerIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.providerIdField]: this.providerId
    };
  }
}
