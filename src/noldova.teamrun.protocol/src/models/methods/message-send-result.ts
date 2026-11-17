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
import { Message } from "../message.js";

export class MessageSendResult {
  public readonly sent: Message;
  public readonly replies: readonly Message[];
  public readonly wakeId: string | null;

  public constructor(sent: Message, replies: readonly Message[], wakeId: string | null = null) {
    if (!Object.isNull(wakeId))
      ArgumentException.throwIfNullOrWhitespace(wakeId, Resources.wakeIdField);

    this.sent = sent;
    this.replies = [...replies];
    this.wakeId = wakeId;
  }

  public static fromJson(value: unknown, path?: string): MessageSendResult {
    const reader = JsonReader.fromValue(value, path);
    const sent = reader.readObject(Resources.sentField);
    return new MessageSendResult(Message.fromJson(sent.toJson(), sent.path),
      reader.readObjectArray(Resources.repliesField).map(t => Message.fromJson(t.toJson(), t.path)),
      reader.hasField(Resources.wakeIdField) ? reader.readNonBlankString(Resources.wakeIdField) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.sentField]: this.sent.toJson(),
      [Resources.repliesField]: this.replies.map(t => t.toJson()),
      ...(Object.isNull(this.wakeId) ? {} : { [Resources.wakeIdField]: this.wakeId })
    };
  }
}
