/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { MessageAuthor } from "../../enums/message-author.js";
import { Resources } from "../../resources.js";

export class MessageSearchHit {
  public readonly chatId: string;
  public readonly projectId: string | null;
  public readonly chatTitle: string;
  public readonly messageId: string;
  public readonly sequence: number;
  public readonly author: MessageAuthor;
  public readonly senderName: string | null;
  public readonly teammateName: string | null;
  public readonly providerId: string | null;
  public readonly providerKind: string | null;
  public readonly snippet: string;
  public readonly createdAt: string;

  public constructor(chatId: string, projectId: string | null, chatTitle: string, messageId: string, sequence: number, author: MessageAuthor,
    senderName: string | null, teammateName: string | null, providerId: string | null, providerKind: string | null, snippet: string, createdAt: string) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    if (!Object.isNull(projectId))
      ArgumentException.throwIfNullOrWhitespace(projectId, Resources.projectIdField);
    ArgumentException.throwIfNullOrWhitespace(messageId, Resources.messageIdField);
    if (!Number.isInteger(sequence) || sequence < 0)
      throw new ArgumentOutOfRangeException(Resources.sequenceField, sequence);
    if (!Object.isNull(senderName))
      ArgumentException.throwIfNullOrWhitespace(senderName, Resources.senderNameField);
    if (!Object.isNull(teammateName))
      ArgumentException.throwIfNullOrWhitespace(teammateName, Resources.teammateNameField);
    if (!Object.isNull(providerId))
      ArgumentException.throwIfNullOrWhitespace(providerId, Resources.providerIdField);
    if (!Object.isNull(providerKind))
      ArgumentException.throwIfNullOrWhitespace(providerKind, Resources.providerKindField);
    ArgumentException.throwIfNullOrWhitespace(createdAt, Resources.createdAtField);

    this.chatId = chatId;
    this.projectId = projectId;
    this.chatTitle = chatTitle;
    this.messageId = messageId;
    this.sequence = sequence;
    this.author = author;
    this.senderName = senderName;
    this.teammateName = teammateName;
    this.providerId = providerId;
    this.providerKind = providerKind;
    this.snippet = snippet;
    this.createdAt = createdAt;
  }

  public static fromJson(value: unknown, path?: string): MessageSearchHit {
    const reader = JsonReader.fromValue(value, path);
    return new MessageSearchHit(
      reader.readNonBlankString(Resources.chatIdField),
      MessageSearchHit.readNullable(reader, Resources.projectIdField),
      reader.readString(Resources.chatTitleField),
      reader.readNonBlankString(Resources.messageIdField),
      reader.readInteger(Resources.sequenceField),
      reader.readOneOf(Resources.authorField, Object.values(MessageAuthor)),
      MessageSearchHit.readNullable(reader, Resources.senderNameField),
      MessageSearchHit.readNullable(reader, Resources.teammateNameField),
      MessageSearchHit.readNullable(reader, Resources.providerIdField),
      MessageSearchHit.readNullable(reader, Resources.providerKindField),
      reader.readString(Resources.snippetField),
      reader.readNonBlankString(Resources.createdAtField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.projectIdField]: this.projectId,
      [Resources.chatTitleField]: this.chatTitle,
      [Resources.messageIdField]: this.messageId,
      [Resources.sequenceField]: this.sequence,
      [Resources.authorField]: this.author,
      [Resources.senderNameField]: this.senderName,
      [Resources.teammateNameField]: this.teammateName,
      [Resources.providerIdField]: this.providerId,
      [Resources.providerKindField]: this.providerKind,
      [Resources.snippetField]: this.snippet,
      [Resources.createdAtField]: this.createdAt
    };
  }

  private static readNullable(reader: JsonReader, field: string): string | null {
    return Object.isNull(reader.readNullableString(field)) ? null : reader.readNonBlankString(field);
  }
}
