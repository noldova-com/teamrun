/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";

export class ConversationRewoundPayload {
  public readonly conversationId: string;
  public readonly fromSequence: number;

  public constructor(conversationId: string, fromSequence: number) {
    ArgumentException.throwIfNullOrWhitespace(conversationId, Resources.conversationIdField);
    if (!Number.isInteger(fromSequence) || fromSequence < 0)
      throw new ArgumentOutOfRangeException(Resources.fromSequenceField, fromSequence);

    this.conversationId = conversationId;
    this.fromSequence = fromSequence;
  }

  public static fromJson(value: unknown, path?: string): ConversationRewoundPayload {
    const reader = JsonReader.fromValue(value, path);
    return new ConversationRewoundPayload(reader.readNonBlankString(Resources.conversationIdField), reader.readInteger(Resources.fromSequenceField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.conversationIdField]: this.conversationId,
      [Resources.fromSequenceField]: this.fromSequence
    };
  }
}
