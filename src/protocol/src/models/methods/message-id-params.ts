/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";

export class MessageIdParams {
  public readonly messageId: string;

  public constructor(messageId: string) {
    ArgumentException.throwIfNullOrWhitespace(messageId, Resources.messageIdField);

    this.messageId = messageId;
  }

  public static fromJson(value: unknown, path?: string): MessageIdParams {
    const reader = JsonReader.fromValue(value, path);
    return new MessageIdParams(reader.readNonBlankString(Resources.messageIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.messageIdField]: this.messageId
    };
  }
}
