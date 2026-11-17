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

export class ProviderEnabledParams {
  public readonly providerId: string;
  public readonly enabled: boolean;

  public constructor(providerId: string, enabled: boolean) {
    ArgumentException.throwIfNullOrWhitespace(providerId, Resources.providerIdField);

    this.providerId = providerId;
    this.enabled = enabled;
  }

  public static fromJson(value: unknown, path?: string): ProviderEnabledParams {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderEnabledParams(reader.readNonBlankString(Resources.providerIdField), reader.readBoolean(Resources.enabledField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.providerIdField]: this.providerId,
      [Resources.enabledField]: this.enabled
    };
  }
}
