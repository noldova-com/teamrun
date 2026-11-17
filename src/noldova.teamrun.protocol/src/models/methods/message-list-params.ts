/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { DetailKind } from "../../enums/detail-kind.js";
import { Resources } from "../../resources.js";

export class MessageListParams {
  public readonly chatId: string;
  public readonly afterSequence: number | null;
  public readonly kinds: readonly DetailKind[];

  public constructor(chatId: string, afterSequence: number | null, kinds: readonly DetailKind[] = []) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    if (!Object.isNull(afterSequence) && (!Number.isInteger(afterSequence) || afterSequence < 0))
      throw new ArgumentOutOfRangeException(Resources.afterSequenceField, afterSequence);
    for (const kind of kinds)
      if (!Object.values(DetailKind).includes(kind))
        throw new ArgumentOutOfRangeException(Resources.kindsField, kind);

    this.chatId = chatId;
    this.afterSequence = afterSequence;
    this.kinds = [...kinds];
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): MessageListParams {
    const reader = JsonReader.fromValue(value, path);
    return new MessageListParams(reader.readNonBlankString(Resources.chatIdField), reader.readNullableInteger(Resources.afterSequenceField),
      reader.readStringArray(Resources.kindsField) as readonly DetailKind[]);
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.afterSequenceField]: this.afterSequence,
      [Resources.kindsField]: [...this.kinds]
    };
  }
}
