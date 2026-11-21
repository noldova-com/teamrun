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

import { DetailKind } from "../enums/detail-kind.js";
import { MessageAuthor } from "../enums/message-author.js";
import { MessageStatus } from "../enums/message-status.js";
import { Resources } from "../resources.js";
import type { Message } from "./message.js";

export class TeammateLastReply {
  public readonly teammateId: string;
  public readonly chatId: string;
  public readonly messageId: string;
  public readonly text: string;
  public readonly endedAt: string;

  public constructor(teammateId: string, chatId: string, messageId: string, text: string, endedAt: string) {
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(messageId, Resources.messageIdField);
    ArgumentException.throwIfNullOrWhitespace(text, Resources.textField);
    ArgumentException.throwIfNullOrWhitespace(endedAt, Resources.endedAtField);

    this.teammateId = teammateId;
    this.chatId = chatId;
    this.messageId = messageId;
    this.text = text;
    this.endedAt = endedAt;
  }

  public static fromJson(value: unknown, path?: string): TeammateLastReply {
    const reader = JsonReader.fromValue(value, path);
    return new TeammateLastReply(reader.readNonBlankString(Resources.teammateIdField), reader.readNonBlankString(Resources.chatIdField),
      reader.readNonBlankString(Resources.messageIdField), reader.readNonBlankString(Resources.textField), reader.readNonBlankString(Resources.endedAtField));
  }

  public static of(message: Message): TeammateLastReply | null {
    const text = message.details.filter(t => t.kind === DetailKind.Text).map(t => t.text).join(" ");
    return message.author !== MessageAuthor.Provider || message.status !== MessageStatus.Completed || Object.isNull(message.teammateId)
      || Object.isNull(message.endedAt) || String.isNullOrWhitespace(text)
      ? null : new TeammateLastReply(message.teammateId, message.chatId, message.id, text, message.endedAt);
  }

  public equals(other: TeammateLastReply): boolean {
    return this.teammateId === other.teammateId && this.chatId === other.chatId && this.messageId === other.messageId && this.text === other.text
      && this.endedAt === other.endedAt;
  }

  public toJson(): JsonObject {
    return {
      [Resources.teammateIdField]: this.teammateId,
      [Resources.chatIdField]: this.chatId,
      [Resources.messageIdField]: this.messageId,
      [Resources.textField]: this.text,
      [Resources.endedAtField]: this.endedAt
    };
  }
}
