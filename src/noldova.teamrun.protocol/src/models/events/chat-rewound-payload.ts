/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class ChatRewoundPayload {
  public readonly chatId: string;
  public readonly fromSequence: number;

  public constructor(chatId: string, fromSequence: number) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    if (!Number.isInteger(fromSequence) || fromSequence < 0)
      throw new ArgumentOutOfRangeException(Resources.fromSequenceField, fromSequence);

    this.chatId = chatId;
    this.fromSequence = fromSequence;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): ChatRewoundPayload {
    const reader = JsonReader.fromValue(value, path);
    return new ChatRewoundPayload(reader.readNonBlankString(Resources.chatIdField), reader.readInteger(Resources.fromSequenceField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.fromSequenceField]: this.fromSequence
    };
  }
}
