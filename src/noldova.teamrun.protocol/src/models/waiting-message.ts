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

import { MessageDelivery } from "../enums/message-delivery.js";
import { Resources } from "../resources.js";
import { MessageSendParams } from "./methods/message-send-params.js";

export class WaitingMessage {
  public readonly id: string;
  public readonly delivery: MessageDelivery;
  public readonly message: MessageSendParams;
  public readonly createdAt: string;
  public readonly failure: string | null;

  public constructor(id: string, delivery: MessageDelivery, message: MessageSendParams, createdAt: string, failure: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(createdAt, Resources.createdAtField);
    if (!Object.isNull(message.senderToken))
      throw new ArgumentException(Resources.waitingFromPersonOnly, Resources.messageField);
    if (!Object.isNull(failure))
      ArgumentException.throwIfNullOrWhitespace(failure, Resources.failureField);

    this.id = id;
    this.delivery = delivery;
    this.message = message;
    this.createdAt = createdAt;
    this.failure = failure;
  }

  public get chatId(): string {
    return this.message.chatId;
  }

  public withDelivery(delivery: MessageDelivery): WaitingMessage {
    return new WaitingMessage(this.id, delivery, this.message, this.createdAt, this.failure);
  }

  public withMessage(message: MessageSendParams): WaitingMessage {
    return new WaitingMessage(this.id, this.delivery, message, this.createdAt);
  }

  public withFailure(failure: string): WaitingMessage {
    return new WaitingMessage(this.id, this.delivery, this.message, this.createdAt, failure);
  }

  public static fromJson(value: unknown, path?: string): WaitingMessage {
    const reader = JsonReader.fromValue(value, path);
    const message = reader.readObject(Resources.messageField);
    return new WaitingMessage(
      reader.readNonBlankString(Resources.idField),
      reader.readOneOf(Resources.deliveryField, Object.values(MessageDelivery)),
      MessageSendParams.fromJson(message.toJson(), message.path),
      reader.readNonBlankString(Resources.createdAtField),
      reader.hasField(Resources.failureField) ? reader.readNonBlankString(Resources.failureField) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.chatIdField]: this.chatId,
      [Resources.deliveryField]: this.delivery,
      [Resources.messageField]: this.message.toJson(),
      [Resources.createdAtField]: this.createdAt,
      ...(Object.isNull(this.failure) ? {} : { [Resources.failureField]: this.failure })
    };
  }
}
