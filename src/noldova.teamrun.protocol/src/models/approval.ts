/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";

import { ApprovalKind } from "../enums/approval-kind.js";
import { ApprovalOutcome } from "../enums/approval-outcome.js";
import { ApprovalStatus } from "../enums/approval-status.js";
import { Resources } from "../resources.js";
import { ApprovalOption } from "./approval-option.js";
import { ApprovalQuestion } from "./approval-question.js";
import { QuestionAnswer } from "./question-answer.js";

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
  public readonly questions: readonly ApprovalQuestion[];
  public readonly answers: readonly QuestionAnswer[] | null;

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
    decidedAt: string | null,
    questions: readonly ApprovalQuestion[] = [],
    answers: readonly QuestionAnswer[] | null = null) {
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
    Approval.validateQuestions(kind, status, questions, answers);

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
    this.questions = [...questions];
    this.answers = Object.isNull(answers) ? null : [...answers];
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
      reader.readNullableString(Resources.decidedAtField),
      reader.hasField(Resources.questionsField)
        ? reader.readObjectArray(Resources.questionsField).map(t => ApprovalQuestion.fromJson(t.toJson(), t.path)) : [],
      reader.hasField(Resources.answersField)
        ? reader.readObjectArray(Resources.answersField).map(t => QuestionAnswer.fromJson(t.toJson(), t.path)) : null);
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
      [Resources.decidedAtField]: this.decidedAt,
      ...(this.questions.length === 0 ? {} : { [Resources.questionsField]: this.questions.map(t => t.toJson()) }),
      ...(Object.isNull(this.answers) ? {} : { [Resources.answersField]: this.answers.map(t => t.toJson()) })
    };
  }

  public withDecision(optionId: string, decidedAt: string, answers: readonly QuestionAnswer[] | null = null): Approval {
    const chosen = this.options.find(t => t.id === optionId);
    if (Object.isUndefined(chosen))
      throw new ArgumentException(Resources.unknownDecision, Resources.decisionField);

    const status = chosen.outcome === ApprovalOutcome.Approved ? ApprovalStatus.Approved : ApprovalStatus.Denied;
    return new Approval(this.id, this.messageId, this.kind, this.nativeKind, this.summary, this.payload, this.options, status, optionId, this.createdAt, decidedAt,
      this.questions, status === ApprovalStatus.Approved ? answers : null);
  }

  public withCancellation(decidedAt: string): Approval {
    return new Approval(this.id, this.messageId, this.kind, this.nativeKind, this.summary, this.payload, this.options, ApprovalStatus.Cancelled, null, this.createdAt, decidedAt,
      this.questions);
  }

  private static validateQuestions(kind: ApprovalKind, status: ApprovalStatus, questions: readonly ApprovalQuestion[], answers: readonly QuestionAnswer[] | null): void {
    const ids = new Set(questions.map(t => t.id));
    if ((kind === ApprovalKind.Question) !== (questions.length > 0) || ids.size !== questions.length)
      throw new ArgumentException(Resources.questionsKindMismatch, Resources.questionsField);
    if (Object.isNull(answers))
      return;
    const answered = new Set(answers.map(t => t.questionId));
    if (kind !== ApprovalKind.Question || status !== ApprovalStatus.Approved || answered.size !== answers.length || [...answered].some(t => !ids.has(t)))
      throw new ArgumentException(Resources.answersStatusMismatch, Resources.answersField);
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
