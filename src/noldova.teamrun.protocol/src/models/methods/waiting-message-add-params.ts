/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";

import { MessageDelivery } from "../../enums/message-delivery.js";
import { Resources } from "../../resources.js";
import { MessageSendParams } from "./message-send-params.js";

export class WaitingMessageAddParams {
  public readonly message: MessageSendParams;
  public readonly delivery: MessageDelivery;

  public constructor(message: MessageSendParams, delivery: MessageDelivery) {
    this.message = message;
    this.delivery = delivery;
  }

  public static fromJson(value: unknown, path?: string): WaitingMessageAddParams {
    const reader = JsonReader.fromValue(value, path);
    const message = reader.readObject(Resources.messageField);
    return new WaitingMessageAddParams(MessageSendParams.fromJson(message.toJson(), message.path),
      reader.readOneOf(Resources.deliveryField, Object.values(MessageDelivery)));
  }

  public toJson(): JsonObject {
    return {
      [Resources.messageField]: this.message.toJson(),
      [Resources.deliveryField]: this.delivery
    };
  }
}
