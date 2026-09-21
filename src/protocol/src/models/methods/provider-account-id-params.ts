/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";

export class ProviderAccountIdParams {
  public readonly providerAccountId: string;

  public constructor(providerAccountId: string) {
    ArgumentException.throwIfNullOrWhitespace(providerAccountId, Resources.providerAccountIdField);

    this.providerAccountId = providerAccountId;
  }

  public static fromJson(value: unknown, path?: string): ProviderAccountIdParams {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderAccountIdParams(reader.readNonBlankString(Resources.providerAccountIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.providerAccountIdField]: this.providerAccountId
    };
  }
}
