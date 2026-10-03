/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";

import { QuitQuestion } from "../../../src/app/models/quit-question";

describe("QuitQuestion", () => {
  it("reads the work in progress and whether the person chose to wait, and shows at most five pieces of work", () => {
    const question = QuitQuestion.fromJson({ descriptions: ["One", "Two", "Three", "Four", "Five", "Six"], isWaiting: true });
    const short = new QuitQuestion(["One"], false);

    expect([question.shown, question.hiddenCount, question.isWaiting]).toEqual([["One", "Two", "Three", "Four", "Five"], 1, true]);
    expect([short.shown, short.hiddenCount, short.isWaiting]).toEqual([["One"], 0, false]);
  });

  it("refuses a question without its fields", () => {
    expect(() => QuitQuestion.fromJson({ descriptions: [] })).toThrow(JsonException);
    expect(() => QuitQuestion.fromJson({ isWaiting: false })).toThrow(JsonException);
  });
});
