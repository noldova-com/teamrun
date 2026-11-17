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
import { ChatResponder } from "../chat-responder.js";

export class ChatResponderParams {
  public readonly chatId: string;
  public readonly responder: ChatResponder | null;
  public readonly chosen: boolean;

  public constructor(chatId: string, responder: ChatResponder | null, chosen: boolean = false) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);

    this.chatId = chatId;
    this.responder = responder;
    this.chosen = chosen;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): ChatResponderParams {
    const reader = JsonReader.fromValue(value, path);
    const responder = reader.readNullableObject(Resources.responderField);
    return new ChatResponderParams(reader.readNonBlankString(Resources.chatIdField),
      Object.isNull(responder) ? null : ChatResponder.fromJson(responder.toJson(), responder.path),
      reader.hasField(Resources.chosenField) ? reader.readBoolean(Resources.chosenField) : false);
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.responderField]: Object.isNull(this.responder) ? null : this.responder.toJson(),
      [Resources.chosenField]: this.chosen
    };
  }
}
