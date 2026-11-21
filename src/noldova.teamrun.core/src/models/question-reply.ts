/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class QuestionReply {
  public readonly question: string;
  public readonly answer: string;

  public constructor(question: string, answer: string) {
    this.question = question;
    this.answer = answer;
  }
}
