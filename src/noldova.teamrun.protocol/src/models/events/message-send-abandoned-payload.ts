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

export class MessageSendAbandonedPayload {
  public readonly sendId: string;

  public constructor(sendId: string) {
    ArgumentException.throwIfNullOrWhitespace(sendId, Resources.sendIdField);

    this.sendId = sendId;
  }

  public static fromJson(value: unknown, path?: string): MessageSendAbandonedPayload {
    return new MessageSendAbandonedPayload(JsonReader.fromValue(value, path).readNonBlankString(Resources.sendIdField));
  }

  public toJson(): JsonObject {
    return { [Resources.sendIdField]: this.sendId };
  }
}
