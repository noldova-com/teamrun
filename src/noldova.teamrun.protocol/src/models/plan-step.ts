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

import { PlanStepStatus } from "../enums/plan-step-status.js";
import { Resources } from "../resources.js";

export class PlanStep {
  public readonly text: string;
  public readonly status: PlanStepStatus;
  public readonly activeText: string | null;

  public constructor(text: string, status: PlanStepStatus, activeText: string | null) {
    ArgumentException.throwIfNullOrWhitespace(text, Resources.textField);
    if (!Object.isNull(activeText))
      ArgumentException.throwIfNullOrWhitespace(activeText, Resources.activeTextField);

    this.text = text;
    this.status = status;
    this.activeText = activeText;
  }

  public static fromJson(value: unknown, path?: string): PlanStep {
    const reader = JsonReader.fromValue(value, path);
    return new PlanStep(
      reader.readNonBlankString(Resources.textField),
      reader.readOneOf(Resources.statusField, Object.values(PlanStepStatus)),
      reader.readNullableString(Resources.activeTextField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.textField]: this.text,
      [Resources.statusField]: this.status,
      [Resources.activeTextField]: this.activeText
    };
  }
}
