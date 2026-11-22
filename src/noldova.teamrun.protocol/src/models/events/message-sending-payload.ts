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

export class MessageSendingPayload {
  public readonly sendId: string;
  public readonly chatId: string;
  public readonly teammateId: string;
  public readonly toChatId: string;

  public constructor(sendId: string, chatId: string, teammateId: string, toChatId: string) {
    ArgumentException.throwIfNullOrWhitespace(sendId, Resources.sendIdField);
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);
    ArgumentException.throwIfNullOrWhitespace(toChatId, Resources.toChatIdField);

    this.sendId = sendId;
    this.chatId = chatId;
    this.teammateId = teammateId;
    this.toChatId = toChatId;
  }

  public static fromJson(value: unknown, path?: string): MessageSendingPayload {
    const reader = JsonReader.fromValue(value, path);
    return new MessageSendingPayload(reader.readNonBlankString(Resources.sendIdField), reader.readNonBlankString(Resources.chatIdField),
      reader.readNonBlankString(Resources.teammateIdField), reader.readNonBlankString(Resources.toChatIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.sendIdField]: this.sendId,
      [Resources.chatIdField]: this.chatId,
      [Resources.teammateIdField]: this.teammateId,
      [Resources.toChatIdField]: this.toChatId
    };
  }
}
