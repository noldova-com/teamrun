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

export class CursorQuestionReader implements IAcpQuestionReader {
  public readonly methods: readonly string[] = Resources.cursorAskQuestionMethods;
  public readonly nativeKind: string = Resources.cursorAskQuestionTool;

  public claims(): boolean {
    return true;
  }

  public read(params: JsonReader): readonly ApprovalQuestion[] | null {
    try {
      const header = params.readOptionalString(Resources.titleField) ?? String.empty;
      const questions = params.readObjectArray(Resources.questionsField).map(t => new ApprovalQuestion(t.readNonBlankString(Resources.idField), header,
        t.readNonBlankString(Resources.promptField), CursorQuestionReader.optionsOf(t).map(u => new QuestionOption(u.readNonBlankString(Resources.labelField),
          String.empty)), t.toJson()[Resources.cursorAllowMultipleField] === true, false, false));
      return questions.length === 0 || new Set(questions.map(t => t.id)).size < questions.length ? null : questions;
    }
    catch {
      return null;
    }
  }

  public reply(params: JsonReader, answers: readonly QuestionAnswer[] | null): JsonObject {
    if (Object.isNull(answers))
      return { [Resources.cursorOutcomeField]: { [Resources.cursorOutcomeField]: Resources.acpCancelled } };
    const questions = params.readObjectArray(Resources.questionsField);

    return {
      [Resources.cursorOutcomeField]: {
        [Resources.cursorOutcomeField]: Resources.cursorAnsweredOutcome,
        [Resources.answersField]: answers.map(t => {
          const options = CursorQuestionReader.optionsOf(questions.find(u => u.readNonBlankString(Resources.idField) === t.questionId) ?? null);
          return {
            [Resources.cursorQuestionIdField]: t.questionId,
            [Resources.cursorSelectedOptionsField]: t.choices.flatMap(u => {
              const option = options.find(v => v.readNonBlankString(Resources.labelField) === u);
              return Object.isUndefined(option) ? [] : [option.readNonBlankString(Resources.idField)];
            })
          };
        })
      }
    };
  }

  private static optionsOf(question: JsonReader | null): readonly JsonReader[] {
    return Object.isNull(question) ? [] : question.readObjectArray(Resources.optionsField);
  }
}
