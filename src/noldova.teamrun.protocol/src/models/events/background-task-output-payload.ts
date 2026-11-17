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

export class BackgroundTaskOutputPayload {
  public readonly chatId: string;
  public readonly taskId: string;
  public readonly text: string;

  public constructor(chatId: string, taskId: string, text: string) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(taskId, Resources.taskIdField);
    ArgumentException.throwIfNullOrEmpty(text, Resources.textField);

    this.chatId = chatId;
    this.taskId = taskId;
    this.text = text;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): BackgroundTaskOutputPayload {
    const reader = JsonReader.fromValue(value, path);
    return new BackgroundTaskOutputPayload(reader.readNonBlankString(Resources.chatIdField), reader.readNonBlankString(Resources.taskIdField),
      reader.readString(Resources.textField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.taskIdField]: this.taskId,
      [Resources.textField]: this.text
    };
  }
}
