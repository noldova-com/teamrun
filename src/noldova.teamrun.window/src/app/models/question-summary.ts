/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { Approval } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";

export class QuestionSummary {
  public readonly questionId: string;
  public readonly label: string;
  public readonly reply: string;

  public constructor(questionId: string, label: string, reply: string) {
    this.questionId = questionId;
    this.label = label;
    this.reply = reply;
  }

  public static of(approval: Approval): readonly QuestionSummary[] {
    return approval.questions.map(t => {
      const answer = approval.answers?.find(u => u.questionId === t.id);
      const reply = Object.isUndefined(answer) ? Resources.questionHiddenAnswer
        : [...answer.choices, ...(Object.isNull(answer.text) ? [] : [answer.text])].join(Resources.questionAnswerSeparator);
      return new QuestionSummary(t.id, String.isNullOrWhitespace(t.header) ? t.text : t.header, reply);
    });
  }
}
