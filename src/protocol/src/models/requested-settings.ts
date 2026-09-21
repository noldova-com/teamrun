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

export class RequestedSettings {
  public readonly provider: string;
  public readonly model: string | null;
  public readonly effort: string | null;

  public constructor(provider: string, model: string | null, effort: string | null) {
    ArgumentException.throwIfNullOrWhitespace(provider, Resources.providerField);

    this.provider = provider;
    this.model = model;
    this.effort = effort;
  }

  public static fromJson(value: unknown, path?: string): RequestedSettings {
    const reader = JsonReader.fromValue(value, path);
    return new RequestedSettings(
      reader.readNonBlankString(Resources.providerField),
      reader.readNullableString(Resources.modelField),
      reader.readNullableString(Resources.effortField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.providerField]: this.provider,
      [Resources.modelField]: this.model,
      [Resources.effortField]: this.effort
    };
  }
}
