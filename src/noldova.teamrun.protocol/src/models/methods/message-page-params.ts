/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class MessagePageParams {
  public readonly chatId: string;
  public readonly beforeSequence: number | null;
  public readonly afterSequence: number | null;
  public readonly limit: number;

  public constructor(chatId: string, beforeSequence: number | null, afterSequence: number | null, limit: number) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    if (!Object.isNull(beforeSequence) && (!Number.isInteger(beforeSequence) || beforeSequence < 0))
      throw new ArgumentOutOfRangeException(Resources.beforeSequenceField, beforeSequence);
    if (!Object.isNull(afterSequence) && (!Number.isInteger(afterSequence) || afterSequence < 0))
      throw new ArgumentOutOfRangeException(Resources.afterSequenceField, afterSequence);
    if (!Object.isNull(beforeSequence) && !Object.isNull(afterSequence))
      throw new ArgumentException(Resources.pageCursorsMismatch, Resources.beforeSequenceField);
    if (!Number.isInteger(limit) || limit < 1 || limit > Resources.maximumPageSize)
      throw new ArgumentOutOfRangeException(Resources.limitField, limit);

    this.chatId = chatId;
    this.beforeSequence = beforeSequence;
    this.afterSequence = afterSequence;
    this.limit = limit;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): MessagePageParams {
    const reader = JsonReader.fromValue(value, path);
    return new MessagePageParams(reader.readNonBlankString(Resources.chatIdField), reader.readNullableInteger(Resources.beforeSequenceField),
      reader.readNullableInteger(Resources.afterSequenceField), reader.readInteger(Resources.limitField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.beforeSequenceField]: this.beforeSequence,
      [Resources.afterSequenceField]: this.afterSequence,
      [Resources.limitField]: this.limit
    };
  }
}
