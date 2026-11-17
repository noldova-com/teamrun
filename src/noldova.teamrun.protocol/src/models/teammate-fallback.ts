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

export class TeammateFallback {
  public readonly providerId: string;
  public readonly model: string | null;
  public readonly effort: string | null;

  public constructor(providerId: string, model: string | null = null, effort: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(providerId, Resources.providerIdField);
    if (!Object.isNull(model))
      ArgumentException.throwIfNullOrWhitespace(model, Resources.modelField);
    if (!Object.isNull(effort))
      ArgumentException.throwIfNullOrWhitespace(effort, Resources.effortField);

    this.providerId = providerId;
    this.model = model;
    this.effort = effort;
  }

  public static fromJson(value: unknown, path?: string): TeammateFallback {
    const reader = JsonReader.fromValue(value, path);
    return new TeammateFallback(reader.readNonBlankString(Resources.providerIdField), reader.readNullableString(Resources.modelField),
      reader.readNullableString(Resources.effortField));
  }

  public static readList(reader: JsonReader): readonly TeammateFallback[] {
    return reader.readObjectArray(Resources.fallbacksField).map(t => TeammateFallback.fromJson(t.toJson(), t.path));
  }

  public equals(other: TeammateFallback): boolean {
    return this.providerId === other.providerId && this.model === other.model && this.effort === other.effort;
  }

  public toJson(): JsonObject {
    return {
      [Resources.providerIdField]: this.providerId,
      [Resources.modelField]: this.model,
      [Resources.effortField]: this.effort
    };
  }
}
