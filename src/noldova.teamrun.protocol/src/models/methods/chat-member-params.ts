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

import { Resources } from "../../resources.js";

export class ChatMemberParams {
  public readonly chatId: string;
  public readonly teammateId: string;

  public constructor(
    chatId: string,
    teammateId: string) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);

    this.chatId = chatId;
    this.teammateId = teammateId;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): ChatMemberParams {
    const reader = JsonReader.fromValue(value, path);
    return new ChatMemberParams(
      reader.readNonBlankString(Resources.chatIdField),
      reader.readNonBlankString(Resources.teammateIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.teammateIdField]: this.teammateId
    };
  }
}
