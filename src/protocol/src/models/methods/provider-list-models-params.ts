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

import { Resources } from "../../resources.js";

export class ProviderListModelsParams {
  public readonly provider: string;
  public readonly providerAccountId: string | null;

  public constructor(provider: string, providerAccountId: string | null) {
    ArgumentException.throwIfNullOrWhitespace(provider, Resources.providerField);
    if (!Object.isNull(providerAccountId))
      ArgumentException.throwIfNullOrWhitespace(providerAccountId, Resources.providerAccountIdField);

    this.provider = provider;
    this.providerAccountId = providerAccountId;
  }

  public static fromJson(value: unknown, path?: string): ProviderListModelsParams {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderListModelsParams(reader.readNonBlankString(Resources.providerField), reader.readNullableString(Resources.providerAccountIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.providerField]: this.provider,
      [Resources.providerAccountIdField]: this.providerAccountId
    };
  }
}
