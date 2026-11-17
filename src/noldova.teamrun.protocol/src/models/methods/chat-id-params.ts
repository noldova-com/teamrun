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

export class ChatIdParams {
  public readonly chatId: string;

  public constructor(chatId: string) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);

    this.chatId = chatId;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): ChatIdParams {
    const reader = JsonReader.fromValue(value, path);
    return new ChatIdParams(reader.readNonBlankString(Resources.chatIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId
    };
  }
}
