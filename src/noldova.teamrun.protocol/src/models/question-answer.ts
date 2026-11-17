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

export class QuestionAnswer {
  public readonly questionId: string;
  public readonly choices: readonly string[];
  public readonly text: string | null;

  public constructor(questionId: string, choices: readonly string[], text: string | null) {
    ArgumentException.throwIfNullOrWhitespace(questionId, Resources.questionIdField);
    if (choices.some(t => String.isNullOrWhitespace(t)) || new Set(choices).size !== choices.length)
      throw new ArgumentException(Resources.answerChoiceInvalid, Resources.choicesField);
    if (choices.length === 0 && String.isNullOrWhitespace(text))
      throw new ArgumentException(Resources.answerWithoutChoice, Resources.choicesField);

    this.questionId = questionId;
    this.choices = [...choices];
    this.text = String.isNullOrWhitespace(text) ? null : text;
  }

  public static fromJson(value: unknown, path?: string): QuestionAnswer {
    const reader = JsonReader.fromValue(value, path);
    return new QuestionAnswer(
      reader.readNonBlankString(Resources.questionIdField),
      reader.readStringArray(Resources.choicesField),
      reader.readNullableString(Resources.textField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.questionIdField]: this.questionId,
      [Resources.choicesField]: [...this.choices],
      [Resources.textField]: this.text
    };
  }
}
