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

export class BackgroundTasksClearedPayload {
  public readonly chatId: string;
  public readonly clearedAt: string;
  public readonly count: number;

  public constructor(chatId: string, clearedAt: string, count: number) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(clearedAt, Resources.clearedAtField);
    if (!Number.isSafeInteger(count) || count < 0)
      throw new ArgumentOutOfRangeException(Resources.countField, count);

    this.chatId = chatId;
    this.clearedAt = clearedAt;
    this.count = count;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): BackgroundTasksClearedPayload {
    const reader = JsonReader.fromValue(value, path);
    return new BackgroundTasksClearedPayload(reader.readNonBlankString(Resources.chatIdField), reader.readNonBlankString(Resources.clearedAtField),
      reader.readInteger(Resources.countField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.clearedAtField]: this.clearedAt,
      [Resources.countField]: this.count
    };
  }
}
