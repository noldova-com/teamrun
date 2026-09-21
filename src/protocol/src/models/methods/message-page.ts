/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";
import { Message } from "../message.js";

export class MessagePage {
  public readonly messages: readonly Message[];
  public readonly hasEarlier: boolean;
  public readonly hasLater: boolean;

  public constructor(messages: readonly Message[], hasEarlier: boolean, hasLater: boolean) {
    this.messages = [...messages];
    this.hasEarlier = hasEarlier;
    this.hasLater = hasLater;
  }

  public static fromJson(value: unknown, path?: string): MessagePage {
    const reader = JsonReader.fromValue(value, path);
    return new MessagePage(reader.readObjectArray(Resources.messagesField).map(t => Message.fromJson(t.toJson(), t.path)),
      reader.readBoolean(Resources.hasEarlierField), reader.readBoolean(Resources.hasLaterField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.messagesField]: this.messages.map(t => t.toJson()),
      [Resources.hasEarlierField]: this.hasEarlier,
      [Resources.hasLaterField]: this.hasLater
    };
  }
}
