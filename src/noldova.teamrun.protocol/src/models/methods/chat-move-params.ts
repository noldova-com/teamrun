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

export class ChatMoveParams {
  public readonly chatId: string;
  public readonly projectId: string;

  public constructor(chatId: string, projectId: string) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(projectId, Resources.projectIdField);

    this.chatId = chatId;
    this.projectId = projectId;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): ChatMoveParams {
    const reader = JsonReader.fromValue(value, path);
    return new ChatMoveParams(reader.readNonBlankString(Resources.chatIdField), reader.readNonBlankString(Resources.projectIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.projectIdField]: this.projectId
    };
  }
}
