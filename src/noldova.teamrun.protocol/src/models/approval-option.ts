/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { ApprovalOutcome } from "../enums/approval-outcome.js";
import { ApprovalScope } from "../enums/approval-scope.js";
import { Resources } from "../resources.js";

export class ApprovalOption {
  public readonly id: string;
  public readonly label: string;
  public readonly outcome: ApprovalOutcome;
  public readonly scope: ApprovalScope;

  public constructor(id: string, label: string, outcome: ApprovalOutcome, scope: ApprovalScope) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(label, Resources.labelField);

    this.id = id;
    this.label = label;
    this.outcome = outcome;
    this.scope = scope;
  }

  public static fromJson(value: unknown, path?: string): ApprovalOption {
    const reader = JsonReader.fromValue(value, path);
    return new ApprovalOption(
      reader.readNonBlankString(Resources.idField),
      reader.readNonBlankString(Resources.labelField),
      reader.readOneOf(Resources.outcomeField, Object.values(ApprovalOutcome)),
      reader.readOneOf(Resources.scopeField, Object.values(ApprovalScope)));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.labelField]: this.label,
      [Resources.outcomeField]: this.outcome,
      [Resources.scopeField]: this.scope
    };
  }
}
