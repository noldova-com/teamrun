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
import { MessageSendParams } from "./message-send-params.js";

export class WaitingMessageEditParams {
  public readonly id: string;
  public readonly message: MessageSendParams;

  public constructor(id: string, message: MessageSendParams) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);

    this.id = id;
    this.message = message;
  }

  public static fromJson(value: unknown, path?: string): WaitingMessageEditParams {
    const reader = JsonReader.fromValue(value, path);
    const message = reader.readObject(Resources.messageField);
    return new WaitingMessageEditParams(reader.readNonBlankString(Resources.idField), MessageSendParams.fromJson(message.toJson(), message.path));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.messageField]: this.message.toJson()
    };
  }
}
