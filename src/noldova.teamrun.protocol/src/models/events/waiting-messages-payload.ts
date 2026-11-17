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
import { WaitingMessage } from "../waiting-message.js";

export class WaitingMessagesPayload {
  public readonly chatId: string;
  public readonly messages: readonly WaitingMessage[];

  public constructor(chatId: string, messages: readonly WaitingMessage[]) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    if (messages.some(t => t.chatId !== chatId))
      throw new ArgumentException(Resources.waitingMessageOfAnotherChat, Resources.messagesField);

    this.chatId = chatId;
    this.messages = [...messages];
  }

  public static fromJson(value: unknown, path?: string): WaitingMessagesPayload {
    const reader = JsonReader.fromValue(value, path);
    return new WaitingMessagesPayload(reader.readNonBlankString(Resources.chatIdField),
      reader.readObjectArray(Resources.messagesField).map(t => WaitingMessage.fromJson(t.toJson(), t.path)));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.messagesField]: this.messages.map(t => t.toJson())
    };
  }
}
