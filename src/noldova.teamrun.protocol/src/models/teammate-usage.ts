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

import { Resources } from "../resources.js";
import { ReplyUsage } from "./reply-usage.js";

export class TeammateUsage {
  public readonly teammateId: string;
  public readonly chatId: string;
  public readonly messageId: string;
  public readonly startedAt: string | null;
  public readonly endedAt: string | null;
  public readonly usage: ReplyUsage;

  public constructor(teammateId: string, chatId: string, messageId: string, startedAt: string | null, endedAt: string | null, usage: ReplyUsage) {
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(messageId, Resources.messageIdField);
    if (!Object.isNull(startedAt))
      ArgumentException.throwIfNullOrWhitespace(startedAt, Resources.startedAtField);
    if (!Object.isNull(endedAt))
      ArgumentException.throwIfNullOrWhitespace(endedAt, Resources.endedAtField);

    this.teammateId = teammateId;
    this.chatId = chatId;
    this.messageId = messageId;
    this.startedAt = startedAt;
    this.endedAt = endedAt;
    this.usage = usage;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): TeammateUsage {
    const reader = JsonReader.fromValue(value, path);
    const usage = reader.readObject(Resources.usageField);
    return new TeammateUsage(reader.readNonBlankString(Resources.teammateIdField), reader.readNonBlankString(Resources.chatIdField),
      reader.readNonBlankString(Resources.messageIdField), reader.readNullableString(Resources.startedAtField),
      reader.readNullableString(Resources.endedAtField), ReplyUsage.fromJson(usage.toJson(), usage.path));
  }

  public toJson(): JsonObject {
    return {
      [Resources.teammateIdField]: this.teammateId,
      [Resources.chatIdField]: this.chatId,
      [Resources.messageIdField]: this.messageId,
      [Resources.startedAtField]: this.startedAt,
      [Resources.endedAtField]: this.endedAt,
      [Resources.usageField]: this.usage.toJson()
    };
  }
}
