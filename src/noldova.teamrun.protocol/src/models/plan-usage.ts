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
import { PlanWindow } from "./plan-window.js";

export class PlanUsage {
  public readonly kind: string;
  public readonly providerId: string | null;
  public readonly windows: readonly PlanWindow[];
  public readonly readAt: string;
  public readonly plan: string | null;
  public readonly usedUp: boolean;
  public readonly usedUpUntil: string | null;

  public constructor(kind: string, providerId: string | null, windows: readonly PlanWindow[], readAt: string, plan: string | null = null, usedUp: boolean = false,
    usedUpUntil: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(kind, Resources.kindField);
    if (!Object.isNull(providerId))
      ArgumentException.throwIfNullOrWhitespace(providerId, Resources.providerIdField);
    ArgumentException.throwIfNullOrWhitespace(readAt, Resources.readAtField);
    if (!Object.isNull(plan))
      ArgumentException.throwIfNullOrWhitespace(plan, Resources.planField);
    if (new Set(windows.map(t => t.name)).size !== windows.length)
      throw new ArgumentException(Resources.planWindowRepeated, Resources.windowsField);
    if (!Object.isNull(usedUpUntil)) {
      ArgumentException.throwIfNullOrWhitespace(usedUpUntil, Resources.usedUpUntilField);
      if (!usedUp)
        throw new ArgumentException(Resources.usedUpUntilWithoutUsedUp, Resources.usedUpUntilField);
    }

    this.kind = kind;
    this.providerId = providerId;
    this.windows = [...windows];
    this.readAt = readAt;
    this.plan = plan;
    this.usedUp = usedUp;
    this.usedUpUntil = usedUpUntil;
  }

  public static fromJson(value: unknown, path?: string): PlanUsage {
    const reader = JsonReader.fromValue(value, path);
    return new PlanUsage(reader.readNonBlankString(Resources.kindField), reader.readNullableString(Resources.providerIdField),
      reader.readObjectArray(Resources.windowsField).map(t => PlanWindow.fromJson(t.toJson(), t.path)), reader.readNonBlankString(Resources.readAtField),
      reader.hasField(Resources.planField) ? reader.readNullableString(Resources.planField) : null,
      reader.hasField(Resources.usedUpField) && reader.readBoolean(Resources.usedUpField),
      reader.hasField(Resources.usedUpUntilField) ? reader.readNullableString(Resources.usedUpUntilField) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind,
      [Resources.providerIdField]: this.providerId,
      [Resources.windowsField]: this.windows.map(t => t.toJson()),
      [Resources.readAtField]: this.readAt,
      [Resources.planField]: this.plan,
      [Resources.usedUpField]: this.usedUp,
      [Resources.usedUpUntilField]: this.usedUpUntil
    };
  }
}
