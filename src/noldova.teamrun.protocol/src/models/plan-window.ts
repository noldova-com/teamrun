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

import { PlanWindowName } from "../enums/plan-window-name.js";
import { Resources } from "../resources.js";

export class PlanWindow {
  public readonly name: PlanWindowName;
  public readonly usedPercent: number | null;
  public readonly resetsAt: string | null;
  public readonly used: number | null;
  public readonly allowance: number | null;
  public readonly unlimited: boolean;
  public readonly balance: number | null;

  public constructor(name: PlanWindowName, usedPercent: number | null, resetsAt: string | null, used: number | null = null, allowance: number | null = null,
    unlimited: boolean = false, balance: number | null = null) {
    if (!Object.isNull(usedPercent) && (!Number.isFinite(usedPercent) || usedPercent < 0))
      throw new ArgumentException(Resources.usedPercentInvalid, Resources.usedPercentField);
    if (!Object.isNull(resetsAt))
      ArgumentException.throwIfNullOrWhitespace(resetsAt, Resources.resetsAtField);
    if (Object.isNull(used) !== Object.isNull(allowance) || ![used, allowance].every(t => Object.isNull(t) || Number.isFinite(t) && t >= 0))
      throw new ArgumentException(Resources.planCountInvalid, Resources.usedField);
    if (!Object.isNull(balance) && (!Number.isFinite(balance) || balance < 0))
      throw new ArgumentException(Resources.balanceInvalid, Resources.balanceField);
    if (unlimited === [usedPercent, used, balance].some(t => !Object.isNull(t)))
      throw new ArgumentException(Resources.planWindowValueMismatch, Resources.unlimitedField);

    this.name = name;
    this.usedPercent = usedPercent;
    this.resetsAt = resetsAt;
    this.used = used;
    this.allowance = allowance;
    this.unlimited = unlimited;
    this.balance = balance;
  }

  public get isUsedUp(): boolean {
    if (!Object.isNull(this.usedPercent))
      return Math.round(this.usedPercent) >= Resources.fullPercent;
    const { used, allowance } = this;
    return !Object.isNull(used) && !Object.isNull(allowance) && allowance > 0 && used >= allowance;
  }

  public static fromJson(value: unknown, path?: string): PlanWindow {
    const reader = JsonReader.fromValue(value, path);
    return new PlanWindow(reader.readOneOf(Resources.nameField, Object.values(PlanWindowName)), PlanWindow.readNullableNumber(reader, Resources.usedPercentField),
      reader.readNullableString(Resources.resetsAtField), PlanWindow.readNullableNumber(reader, Resources.usedField),
      PlanWindow.readNullableNumber(reader, Resources.allowanceField), reader.readBoolean(Resources.unlimitedField),
      PlanWindow.readNullableNumber(reader, Resources.balanceField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.nameField]: this.name,
      [Resources.usedPercentField]: this.usedPercent,
      [Resources.resetsAtField]: this.resetsAt,
      [Resources.usedField]: this.used,
      [Resources.allowanceField]: this.allowance,
      [Resources.unlimitedField]: this.unlimited,
      [Resources.balanceField]: this.balance
    };
  }

  private static readNullableNumber(reader: JsonReader, name: string): number | null {
    return Object.isNull(reader.readValue(name)) ? null : reader.readNumber(name);
  }
}
