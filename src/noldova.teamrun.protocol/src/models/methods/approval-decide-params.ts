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

import { Resources } from "../../resources.js";
import { QuestionAnswer } from "../question-answer.js";

export class ApprovalDecideParams {
  public readonly approvalId: string;
  public readonly optionId: string;
  public readonly answers: readonly QuestionAnswer[] | null;

  public constructor(approvalId: string, optionId: string, answers: readonly QuestionAnswer[] | null = null) {
    ArgumentException.throwIfNullOrWhitespace(approvalId, Resources.approvalIdField);
    ArgumentException.throwIfNullOrWhitespace(optionId, Resources.optionIdField);

    this.approvalId = approvalId;
    this.optionId = optionId;
    this.answers = Object.isNull(answers) ? null : [...answers];
  }

  public static fromJson(value: unknown, path?: string): ApprovalDecideParams {
    const reader = JsonReader.fromValue(value, path);
    return new ApprovalDecideParams(reader.readNonBlankString(Resources.approvalIdField), reader.readNonBlankString(Resources.optionIdField),
      reader.hasField(Resources.answersField)
        ? reader.readObjectArray(Resources.answersField).map(t => QuestionAnswer.fromJson(t.toJson(), t.path)) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.approvalIdField]: this.approvalId,
      [Resources.optionIdField]: this.optionId,
      ...(Object.isNull(this.answers) ? {} : { [Resources.answersField]: this.answers.map(t => t.toJson()) })
    };
  }
}
