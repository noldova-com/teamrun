/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";

export class MessagePageParams {
  public readonly conversationId: string;
  public readonly beforeSequence: number | null;
  public readonly afterSequence: number | null;
  public readonly limit: number;

  public constructor(conversationId: string, beforeSequence: number | null, afterSequence: number | null, limit: number) {
    ArgumentException.throwIfNullOrWhitespace(conversationId, Resources.conversationIdField);
    if (!Object.isNull(beforeSequence) && (!Number.isInteger(beforeSequence) || beforeSequence < 0))
      throw new ArgumentOutOfRangeException(Resources.beforeSequenceField, beforeSequence);
    if (!Object.isNull(afterSequence) && (!Number.isInteger(afterSequence) || afterSequence < 0))
      throw new ArgumentOutOfRangeException(Resources.afterSequenceField, afterSequence);
    if (!Object.isNull(beforeSequence) && !Object.isNull(afterSequence))
      throw new ArgumentException(Resources.pageCursorsMismatch, Resources.beforeSequenceField);
    if (!Number.isInteger(limit) || limit < 1 || limit > Resources.maximumPageSize)
      throw new ArgumentOutOfRangeException(Resources.limitField, limit);

    this.conversationId = conversationId;
    this.beforeSequence = beforeSequence;
    this.afterSequence = afterSequence;
    this.limit = limit;
  }

  public static fromJson(value: unknown, path?: string): MessagePageParams {
    const reader = JsonReader.fromValue(value, path);
    return new MessagePageParams(reader.readNonBlankString(Resources.conversationIdField), reader.readNullableInteger(Resources.beforeSequenceField),
      reader.readNullableInteger(Resources.afterSequenceField), reader.readInteger(Resources.limitField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.conversationIdField]: this.conversationId,
      [Resources.beforeSequenceField]: this.beforeSequence,
      [Resources.afterSequenceField]: this.afterSequence,
      [Resources.limitField]: this.limit
    };
  }
}
