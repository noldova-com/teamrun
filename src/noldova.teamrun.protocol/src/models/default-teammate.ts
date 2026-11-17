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

import { Resources } from "../resources.js";
import { RequestedSettings } from "./requested-settings.js";

export class DefaultTeammate {
  public readonly requested: RequestedSettings;
  public readonly providerId: string | null;

  public constructor(requested: RequestedSettings, providerId: string | null = null) {
    if (!Object.isNull(providerId))
      ArgumentException.throwIfNullOrWhitespace(providerId, Resources.providerIdField);

    this.requested = requested;
    this.providerId = providerId;
  }

  public static fromJson(value: unknown, path?: string): DefaultTeammate {
    const reader = JsonReader.fromValue(value, path);
    const requested = reader.readObject(Resources.requestedField);
    return new DefaultTeammate(RequestedSettings.fromJson(requested.toJson(), requested.path), reader.readNullableString(Resources.providerIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.requestedField]: this.requested.toJson(),
      [Resources.providerIdField]: this.providerId
    };
  }
}
