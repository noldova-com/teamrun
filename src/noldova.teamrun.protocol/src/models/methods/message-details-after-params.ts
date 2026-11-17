/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException, JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class MessageDetailsAfterParams {
  public readonly messageId: string;
  public readonly afterSequence: number;
  public readonly sequences: readonly number[];

  public constructor(messageId: string, afterSequence: number, sequences: readonly number[]) {
    ArgumentException.throwIfNullOrWhitespace(messageId, Resources.messageIdField);
    if (!MessageDetailsAfterParams.isSequence(afterSequence))
      throw new ArgumentOutOfRangeException(Resources.afterSequenceField, afterSequence);
    if (sequences.length > Resources.maximumChangedSequences)
      throw new ArgumentOutOfRangeException(Resources.sequencesField, sequences.length);
    const wrong = sequences.find(t => !MessageDetailsAfterParams.isSequence(t));
    if (!Object.isUndefined(wrong))
      throw new ArgumentOutOfRangeException(Resources.sequencesField, wrong);

    this.messageId = messageId;
    this.afterSequence = afterSequence;
    this.sequences = [...sequences];
  }

  public static fromJson(value: unknown, path?: string): MessageDetailsAfterParams {
    const reader = JsonReader.fromValue(value, path);
    const sequences = reader.readValue(Resources.sequencesField);
    if (!Array.isArray(sequences) || !sequences.every(u => typeof u === "number"))
      throw new JsonException(Resources.invalidChangedSequences, `${reader.path}.${Resources.sequencesField}`);
    return new MessageDetailsAfterParams(reader.readNonBlankString(Resources.messageIdField), reader.readInteger(Resources.afterSequenceField), sequences as number[]);
  }

  public toJson(): JsonObject {
    return {
      [Resources.messageIdField]: this.messageId,
      [Resources.afterSequenceField]: this.afterSequence,
      [Resources.sequencesField]: [...this.sequences]
    };
  }

  private static isSequence(value: number): boolean {
    return Number.isInteger(value) && value >= 0;
  }
}
