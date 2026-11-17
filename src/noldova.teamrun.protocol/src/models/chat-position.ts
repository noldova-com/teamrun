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

import { Resources } from "../resources.js";

export class ChatPosition {
  public readonly chatId: string;
  public readonly messageId: string;
  public readonly sequence: number;
  public readonly distance: number;

  public constructor(chatId: string, messageId: string, sequence: number, distance: number) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(messageId, Resources.messageIdField);
    if (!Number.isInteger(sequence) || sequence < 0)
      throw new ArgumentOutOfRangeException(Resources.sequenceField, sequence);
    if (!Number.isFinite(distance))
      throw new ArgumentOutOfRangeException(Resources.distanceField, distance);

    this.chatId = chatId;
    this.messageId = messageId;
    this.sequence = sequence;
    this.distance = distance;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): ChatPosition {
    const reader = JsonReader.fromValue(value, path);
    return new ChatPosition(
      reader.readNonBlankString(Resources.chatIdField),
      reader.readNonBlankString(Resources.messageIdField),
      reader.readInteger(Resources.sequenceField),
      reader.readNumber(Resources.distanceField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.messageIdField]: this.messageId,
      [Resources.sequenceField]: this.sequence,
      [Resources.distanceField]: this.distance
    };
  }
}
