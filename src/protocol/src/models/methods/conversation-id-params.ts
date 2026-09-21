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

export class ConversationIdParams {
  public readonly conversationId: string;

  public constructor(conversationId: string) {
    ArgumentException.throwIfNullOrWhitespace(conversationId, Resources.conversationIdField);

    this.conversationId = conversationId;
  }

  public static fromJson(value: unknown, path?: string): ConversationIdParams {
    const reader = JsonReader.fromValue(value, path);
    return new ConversationIdParams(reader.readNonBlankString(Resources.conversationIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.conversationIdField]: this.conversationId
    };
  }
}
