/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { ProviderContextWindows } from "./provider-context-windows.js";

export class RequestedSettings {
  public readonly kind: string;
  public readonly model: string | null;
  public readonly effort: string | null;
  public readonly speed: string | null;
  public readonly mode: string | null;
  public readonly planFirst: boolean;
  public readonly contextWindow: number | null;

  public constructor(kind: string, model: string | null, effort: string | null, speed: string | null = null, mode: string | null = null,
    planFirst: boolean = false, contextWindow: number | null = null) {
    ArgumentException.throwIfNullOrWhitespace(kind, Resources.kindField);
    if (!Object.isNull(speed))
      ArgumentException.throwIfNullOrWhitespace(speed, Resources.speedField);
    if (!Object.isNull(mode))
      ArgumentException.throwIfNullOrWhitespace(mode, Resources.modeField);
    if (!Object.isNull(contextWindow) && !ProviderContextWindows.isSize(contextWindow))
      throw new ArgumentException(Resources.chosenContextWindowInvalid, Resources.contextWindowField);

    this.kind = kind;
    this.model = model;
    this.effort = effort;
    this.speed = speed;
    this.mode = mode;
    this.planFirst = planFirst;
    this.contextWindow = contextWindow;
  }

  public static fromJson(value: unknown, path?: string): RequestedSettings {
    const reader = JsonReader.fromValue(value, path);
    return new RequestedSettings(
      reader.readNonBlankString(Resources.kindField),
      reader.readNullableString(Resources.modelField),
      reader.readNullableString(Resources.effortField),
      reader.hasField(Resources.speedField) ? reader.readNullableString(Resources.speedField) : null,
      reader.hasField(Resources.modeField) ? reader.readNullableString(Resources.modeField) : null,
      reader.hasField(Resources.planFirstField) && reader.readBoolean(Resources.planFirstField),
      reader.hasField(Resources.contextWindowField) ? reader.readNullableInteger(Resources.contextWindowField) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind,
      [Resources.modelField]: this.model,
      [Resources.effortField]: this.effort,
      [Resources.speedField]: this.speed,
      [Resources.modeField]: this.mode,
      ...this.planFirst ? { [Resources.planFirstField]: true } : {},
      ...Object.isNull(this.contextWindow) ? {} : { [Resources.contextWindowField]: this.contextWindow }
    };
  }

  public withPlanFirst(planFirst: boolean): RequestedSettings {
    return planFirst === this.planFirst ? this : new RequestedSettings(this.kind, this.model, this.effort, this.speed, this.mode, planFirst, this.contextWindow);
  }
}
