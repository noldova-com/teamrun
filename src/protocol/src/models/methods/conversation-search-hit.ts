/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";

export class ConversationSearchHit {
  public readonly conversationId: string;
  public readonly projectId: string;
  public readonly title: string;
  public readonly messageId: string | null;
  public readonly snippet: string;
  public readonly updatedAt: string;
  public readonly sequence: number | null;

  public constructor(conversationId: string, projectId: string, title: string, messageId: string | null, snippet: string, updatedAt: string,
    sequence: number | null = null) {
    ArgumentException.throwIfNullOrWhitespace(conversationId, Resources.conversationIdField);
    ArgumentException.throwIfNullOrWhitespace(projectId, Resources.projectIdField);
    ArgumentException.throwIfNullOrWhitespace(updatedAt, Resources.updatedAtField);
    if (!Object.isNull(sequence) && (!Number.isInteger(sequence) || sequence < 0))
      throw new ArgumentOutOfRangeException(Resources.sequenceField, sequence);

    this.conversationId = conversationId;
    this.projectId = projectId;
    this.title = title;
    this.messageId = messageId;
    this.snippet = snippet;
    this.updatedAt = updatedAt;
    this.sequence = sequence;
  }

  public static fromJson(value: unknown, path?: string): ConversationSearchHit {
    const reader = JsonReader.fromValue(value, path);
    return new ConversationSearchHit(
      reader.readNonBlankString(Resources.conversationIdField),
      reader.readNonBlankString(Resources.projectIdField),
      reader.readString(Resources.titleField),
      reader.readNullableString(Resources.messageIdField),
      reader.readString(Resources.snippetField),
      reader.readNonBlankString(Resources.updatedAtField),
      reader.readNullableInteger(Resources.sequenceField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.conversationIdField]: this.conversationId,
      [Resources.projectIdField]: this.projectId,
      [Resources.titleField]: this.title,
      [Resources.messageIdField]: this.messageId,
      [Resources.snippetField]: this.snippet,
      [Resources.updatedAtField]: this.updatedAt,
      [Resources.sequenceField]: this.sequence
    };
  }
}
