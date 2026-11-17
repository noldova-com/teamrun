/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class ChatRewindParams {
  public readonly chatId: string;
  public readonly messageId: string;
  public readonly restoreFiles: boolean;

  public constructor(chatId: string, messageId: string, restoreFiles: boolean) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(messageId, Resources.messageIdField);

    this.chatId = chatId;
    this.messageId = messageId;
    this.restoreFiles = restoreFiles;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): ChatRewindParams {
    const reader = JsonReader.fromValue(value, path);
    return new ChatRewindParams(
      reader.readNonBlankString(Resources.chatIdField),
      reader.readNonBlankString(Resources.messageIdField),
      reader.readBoolean(Resources.restoreFilesField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.messageIdField]: this.messageId,
      [Resources.restoreFilesField]: this.restoreFiles
    };
  }
}
