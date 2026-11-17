/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";
import { Message } from "../message.js";

export class MessagePage {
  public readonly messages: readonly Message[];
  public readonly hasEarlier: boolean;
  public readonly hasLater: boolean;
  public readonly count: number;

  public constructor(messages: readonly Message[], hasEarlier: boolean, hasLater: boolean, count: number) {
    if (!Number.isInteger(count) || count < messages.length)
      throw new ArgumentOutOfRangeException(Resources.countField, count);

    this.messages = [...messages];
    this.hasEarlier = hasEarlier;
    this.hasLater = hasLater;
    this.count = count;
  }

  public static fromJson(value: unknown, path?: string): MessagePage {
    const reader = JsonReader.fromValue(value, path);
    return new MessagePage(reader.readObjectArray(Resources.messagesField).map(t => Message.fromJson(t.toJson(), t.path)),
      reader.readBoolean(Resources.hasEarlierField), reader.readBoolean(Resources.hasLaterField), reader.readInteger(Resources.countField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.messagesField]: this.messages.map(t => t.toJson()),
      [Resources.hasEarlierField]: this.hasEarlier,
      [Resources.hasLaterField]: this.hasLater,
      [Resources.countField]: this.count
    };
  }
}
