/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonReader } from "@noldova/context.json";
import { ApprovalQuestion, type QuestionAnswer, QuestionOption } from "@noldova/teamrun.protocol";

import type { IAcpQuestionReader } from "../../interfaces/i-acp-question.reader.js";
import { Resources } from "../../resources.js";

export class GrokQuestionReader implements IAcpQuestionReader {
  public readonly methods: readonly string[] = Resources.xaiAskUserQuestionMethods;
  public readonly nativeKind: string = Resources.xaiAskUserQuestionTool;

  public claims(): boolean {
    return true;
  }

  public read(params: JsonReader): readonly ApprovalQuestion[] | null {
    try {
      const questions = params.readObjectArray(Resources.questionsField).map(t => new ApprovalQuestion(t.readNonBlankString(Resources.questionField), String.empty,
        t.readNonBlankString(Resources.questionField), t.readObjectArray(Resources.optionsField).map(u => new QuestionOption(u.readNonBlankString(Resources.labelField),
          u.readOptionalString(Resources.descriptionField) ?? String.empty)), t.toJson()[Resources.multiSelectField] === true, true, false));
      return questions.length === 0 || new Set(questions.map(t => t.id)).size < questions.length ? null : questions;
    }
    catch {
      return null;
    }
  }

  public reply(_params: JsonReader, answers: readonly QuestionAnswer[] | null): JsonObject {
    if (Object.isNull(answers))
      return { [Resources.xaiOutcomeField]: Resources.acpCancelled };
    const notes = answers.filter(t => !Object.isNull(t.text));

    return {
      [Resources.xaiOutcomeField]: Resources.xaiAcceptedOutcome,
      [Resources.answersField]: Object.fromEntries(answers.map(t => [t.questionId, t.choices.length === 0 ? [Resources.xaiOtherAnswer] : [...t.choices]])),
      ...(notes.length === 0 ? {} : { [Resources.xaiAnnotationsField]: Object.fromEntries(notes.map(t => [t.questionId, { [Resources.xaiNotesField]: t.text }])) })
    };
  }
}
