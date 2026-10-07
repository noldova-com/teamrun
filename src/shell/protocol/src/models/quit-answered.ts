/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { QuitAnswer } from "../enums/quit-answer.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class QuitAnswered {
  private static readonly FIELDS: readonly string[] = [Resources.answerField];
  private static readonly ANSWERS: readonly QuitAnswer[] = Object.values(QuitAnswer);

  public readonly answer: QuitAnswer;

  public constructor(answer: QuitAnswer) {
    this.answer = answer;
  }

  public static fromJson(value: unknown, path?: string): QuitAnswered {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, QuitAnswered.FIELDS);
    return new QuitAnswered(reader.readOneOf(Resources.answerField, QuitAnswered.ANSWERS));
  }

  public toJson(): JsonObject {
    return { [Resources.answerField]: this.answer };
  }
}
