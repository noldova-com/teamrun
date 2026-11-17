/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class ObservedSettings {
  public readonly kind: string | null;
  public readonly model: string | null;
  public readonly effort: string | null;
  public readonly harnessVersion: string | null;
  public readonly unavailableModel: boolean;
  public readonly speed: string | null;
  public readonly speedUnavailable: string | null;

  public constructor(
    kind: string | null,
    model: string | null,
    effort: string | null,
    harnessVersion: string | null,
    unavailableModel: boolean = false,
    speed: string | null = null,
    speedUnavailable: string | null = null) {
    this.kind = kind;
    this.model = model;
    this.effort = effort;
    this.harnessVersion = harnessVersion;
    this.unavailableModel = unavailableModel;
    this.speed = speed;
    this.speedUnavailable = speedUnavailable;
  }

  public static fromJson(value: unknown, path?: string): ObservedSettings {
    const reader = JsonReader.fromValue(value, path);
    return new ObservedSettings(
      reader.readNullableString(Resources.kindField),
      reader.readNullableString(Resources.modelField),
      reader.readNullableString(Resources.effortField),
      reader.readNullableString(Resources.harnessVersionField),
      reader.hasField(Resources.unavailableModelField) ? reader.readBoolean(Resources.unavailableModelField) : false,
      reader.hasField(Resources.speedField) ? reader.readNullableString(Resources.speedField) : null,
      reader.hasField(Resources.speedUnavailableField) ? reader.readNullableString(Resources.speedUnavailableField) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind,
      [Resources.modelField]: this.model,
      [Resources.effortField]: this.effort,
      [Resources.harnessVersionField]: this.harnessVersion,
      [Resources.unavailableModelField]: this.unavailableModel,
      [Resources.speedField]: this.speed,
      [Resources.speedUnavailableField]: this.speedUnavailable
    };
  }
}
