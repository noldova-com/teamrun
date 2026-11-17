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

export class WrittenImageReadParams {
  public readonly chatId: string;
  public readonly messageId: string;
  public readonly path: string;

  public constructor(chatId: string, messageId: string, path: string) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(messageId, Resources.messageIdField);
    ArgumentException.throwIfNullOrWhitespace(path, Resources.pathField);

    this.chatId = chatId;
    this.messageId = messageId;
    this.path = path;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): WrittenImageReadParams {
    const reader = JsonReader.fromValue(value, path);
    return new WrittenImageReadParams(reader.readNonBlankString(Resources.chatIdField), reader.readNonBlankString(Resources.messageIdField),
      reader.readNonBlankString(Resources.pathField));
  }

  public toJson(): JsonObject {
    return { [Resources.chatIdField]: this.chatId, [Resources.messageIdField]: this.messageId, [Resources.pathField]: this.path };
  }
}
