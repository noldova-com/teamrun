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

export class ChatSearchHit {
  public readonly chatId: string;
  public readonly projectId: string | null;
  public readonly title: string;
  public readonly messageId: string | null;
  public readonly snippet: string;
  public readonly updatedAt: string;
  public readonly sequence: number | null;

  public constructor(chatId: string, projectId: string | null, title: string, messageId: string | null, snippet: string, updatedAt: string,
    sequence: number | null = null) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    if (!Object.isNull(projectId))
      ArgumentException.throwIfNullOrWhitespace(projectId, Resources.projectIdField);
    ArgumentException.throwIfNullOrWhitespace(updatedAt, Resources.updatedAtField);
    if (!Object.isNull(sequence) && (!Number.isInteger(sequence) || sequence < 0))
      throw new ArgumentOutOfRangeException(Resources.sequenceField, sequence);

    this.chatId = chatId;
    this.projectId = projectId;
    this.title = title;
    this.messageId = messageId;
    this.snippet = snippet;
    this.updatedAt = updatedAt;
    this.sequence = sequence;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): ChatSearchHit {
    const reader = JsonReader.fromValue(value, path);
    return new ChatSearchHit(
      reader.readNonBlankString(Resources.chatIdField),
      Object.isNull(reader.readNullableString(Resources.projectIdField)) ? null : reader.readNonBlankString(Resources.projectIdField),
      reader.readString(Resources.titleField),
      reader.readNullableString(Resources.messageIdField),
      reader.readString(Resources.snippetField),
      reader.readNonBlankString(Resources.updatedAtField),
      reader.readNullableInteger(Resources.sequenceField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.projectIdField]: this.projectId,
      [Resources.titleField]: this.title,
      [Resources.messageIdField]: this.messageId,
      [Resources.snippetField]: this.snippet,
      [Resources.updatedAtField]: this.updatedAt,
      [Resources.sequenceField]: this.sequence
    };
  }
}
