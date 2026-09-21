/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/teamrun-foundation-json";

import { ApprovalKind } from "../enums/approval-kind.js";
import { ApprovalOutcome } from "../enums/approval-outcome.js";
import { ApprovalStatus } from "../enums/approval-status.js";
import { Resources } from "../resources.js";
import { ApprovalOption } from "./approval-option.js";

export class Approval {
  public readonly id: string;
  public readonly messageId: string;
  public readonly kind: ApprovalKind;
  public readonly nativeKind: string;
  public readonly summary: string;
  public readonly payload: JsonValue;
  public readonly options: readonly ApprovalOption[];
  public readonly status: ApprovalStatus;
  public readonly decision: string | null;
  public readonly createdAt: string;
  public readonly decidedAt: string | null;

  public constructor(
    id: string,
    messageId: string,
    kind: ApprovalKind,
    nativeKind: string,
    summary: string,
    payload: JsonValue,
    options: readonly ApprovalOption[],
    status: ApprovalStatus,
    decision: string | null,
    createdAt: string,
    decidedAt: string | null) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(messageId, Resources.messageIdField);
    ArgumentException.throwIfNullOrWhitespace(nativeKind, Resources.nativeKindField);
    ArgumentException.throwIfNullOrWhitespace(summary, Resources.summaryField);
    ArgumentException.throwIfNullOrWhitespace(createdAt, Resources.createdAtField);
    if (options.length === 0 || new Set(options.map(t => t.id)).size !== options.length)
      throw new ArgumentException(Resources.approvalWithoutOptions, Resources.optionsField);
    if ((status === ApprovalStatus.Pending) !== Object.isNull(decidedAt))
      throw new ArgumentException(Resources.approvalDecisionMismatch, Resources.decidedAtField);
    Approval.validateDecision(options, status, decision);

    this.id = id;
    this.messageId = messageId;
    this.kind = kind;
    this.nativeKind = nativeKind;
    this.summary = summary;
    this.payload = payload;
    this.options = [...options];
    this.status = status;
    this.decision = decision;
    this.createdAt = createdAt;
    this.decidedAt = decidedAt;
  }

  public static fromJson(value: unknown, path?: string): Approval {
    const reader = JsonReader.fromValue(value, path);
    return new Approval(
      reader.readNonBlankString(Resources.idField),
      reader.readNonBlankString(Resources.messageIdField),
      reader.readOneOf(Resources.kindField, Object.values(ApprovalKind)),
      reader.readNonBlankString(Resources.nativeKindField),
      reader.readNonBlankString(Resources.summaryField),
      reader.readValue(Resources.payloadField),
      reader.readObjectArray(Resources.optionsField).map(t => ApprovalOption.fromJson(t.toJson(), t.path)),
      reader.readOneOf(Resources.statusField, Object.values(ApprovalStatus)),
      reader.readNullableString(Resources.decisionField),
      reader.readNonBlankString(Resources.createdAtField),
      reader.readNullableString(Resources.decidedAtField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.messageIdField]: this.messageId,
      [Resources.kindField]: this.kind,
      [Resources.nativeKindField]: this.nativeKind,
      [Resources.summaryField]: this.summary,
      [Resources.payloadField]: this.payload,
      [Resources.optionsField]: this.options.map(t => t.toJson()),
      [Resources.statusField]: this.status,
      [Resources.decisionField]: this.decision,
      [Resources.createdAtField]: this.createdAt,
      [Resources.decidedAtField]: this.decidedAt
    };
  }

  public withDecision(optionId: string, decidedAt: string): Approval {
    const chosen = this.options.find(t => t.id === optionId);
    if (Object.isUndefined(chosen))
      throw new ArgumentException(Resources.unknownDecision, Resources.decisionField);

    const status = chosen.outcome === ApprovalOutcome.Approved ? ApprovalStatus.Approved : ApprovalStatus.Denied;
    return new Approval(this.id, this.messageId, this.kind, this.nativeKind, this.summary, this.payload, this.options, status, optionId, this.createdAt, decidedAt);
  }

  public withCancellation(decidedAt: string): Approval {
    return new Approval(this.id, this.messageId, this.kind, this.nativeKind, this.summary, this.payload, this.options, ApprovalStatus.Cancelled, null, this.createdAt, decidedAt);
  }

  private static validateDecision(options: readonly ApprovalOption[], status: ApprovalStatus, decision: string | null): void {
    const decided = status === ApprovalStatus.Approved || status === ApprovalStatus.Denied;
    if (decided === Object.isNull(decision))
      throw new ArgumentException(Resources.decisionStatusMismatch, Resources.decisionField);
    if (Object.isNull(decision))
      return;
    const chosen = options.find(t => t.id === decision);
    if (Object.isUndefined(chosen))
      throw new ArgumentException(Resources.unknownDecision, Resources.decisionField);
    if ((chosen.outcome === ApprovalOutcome.Approved) !== (status === ApprovalStatus.Approved))
      throw new ArgumentException(Resources.decisionOutcomeMismatch, Resources.decisionField);
  }
}
