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

export class ChatMemberSettings {
  public readonly model: string | null;
  public readonly effort: string | null;
  public readonly speed: string | null;

  public constructor(model: string | null, effort: string | null, speed: string | null = null) {
    if (!Object.isNull(model))
      ArgumentException.throwIfNullOrWhitespace(model, Resources.modelField);
    if (!Object.isNull(effort))
      ArgumentException.throwIfNullOrWhitespace(effort, Resources.effortField);
    if (!Object.isNull(speed))
      ArgumentException.throwIfNullOrWhitespace(speed, Resources.speedField);

    this.model = model;
    this.effort = effort;
    this.speed = speed;
  }

  public static fromJson(value: unknown, path?: string): ChatMemberSettings {
    const reader = JsonReader.fromValue(value, path);
    return new ChatMemberSettings(reader.readNullableString(Resources.modelField), reader.readNullableString(Resources.effortField),
      reader.hasField(Resources.speedField) ? reader.readNullableString(Resources.speedField) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.modelField]: this.model,
      [Resources.effortField]: this.effort,
      [Resources.speedField]: this.speed
    };
  }
}
