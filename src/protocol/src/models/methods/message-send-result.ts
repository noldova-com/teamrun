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

export class MessageSendResult {
  public readonly sent: Message;
  public readonly replies: readonly Message[];

  public constructor(sent: Message, replies: readonly Message[]) {
    this.sent = sent;
    this.replies = [...replies];
  }

  public static fromJson(value: unknown, path?: string): MessageSendResult {
    const reader = JsonReader.fromValue(value, path);
    const sent = reader.readObject(Resources.sentField);
    return new MessageSendResult(Message.fromJson(sent.toJson(), sent.path),
      reader.readObjectArray(Resources.repliesField).map(t => Message.fromJson(t.toJson(), t.path)));
  }

  public toJson(): JsonObject {
    return {
      [Resources.sentField]: this.sent.toJson(),
      [Resources.repliesField]: this.replies.map(t => t.toJson())
    };
  }
}
