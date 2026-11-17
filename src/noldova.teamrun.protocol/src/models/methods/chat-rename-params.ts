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

export class ChatRenameParams {
  public readonly chatId: string;
  public readonly title: string;

  public constructor(chatId: string, title: string) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(title, Resources.titleField);

    this.chatId = chatId;
    this.title = title;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): ChatRenameParams {
    const reader = JsonReader.fromValue(value, path);
    return new ChatRenameParams(reader.readNonBlankString(Resources.chatIdField), reader.readNonBlankString(Resources.titleField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.titleField]: this.title
    };
  }
}
