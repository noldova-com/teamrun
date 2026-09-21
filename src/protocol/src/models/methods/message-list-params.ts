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

import { DetailKind } from "../../enums/detail-kind.js";
import { Resources } from "../../resources.js";

export class MessageListParams {
  public readonly conversationId: string;
  public readonly afterSequence: number | null;
  public readonly kinds: readonly DetailKind[];

  public constructor(conversationId: string, afterSequence: number | null, kinds: readonly DetailKind[] = []) {
    ArgumentException.throwIfNullOrWhitespace(conversationId, Resources.conversationIdField);
    if (!Object.isNull(afterSequence) && (!Number.isInteger(afterSequence) || afterSequence < 0))
      throw new ArgumentOutOfRangeException(Resources.afterSequenceField, afterSequence);
    for (const kind of kinds)
      if (!Object.values(DetailKind).includes(kind))
        throw new ArgumentOutOfRangeException(Resources.kindsField, kind);

    this.conversationId = conversationId;
    this.afterSequence = afterSequence;
    this.kinds = [...kinds];
  }

  public static fromJson(value: unknown, path?: string): MessageListParams {
    const reader = JsonReader.fromValue(value, path);
    return new MessageListParams(reader.readNonBlankString(Resources.conversationIdField), reader.readNullableInteger(Resources.afterSequenceField),
      reader.readStringArray(Resources.kindsField) as readonly DetailKind[]);
  }

  public toJson(): JsonObject {
    return {
      [Resources.conversationIdField]: this.conversationId,
      [Resources.afterSequenceField]: this.afterSequence,
      [Resources.kindsField]: [...this.kinds]
    };
  }
}
