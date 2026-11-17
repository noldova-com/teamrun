/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class DraftDiscardParams {
  public readonly chatId: string;
  public readonly revision: number | null;

  public constructor(chatId: string, revision: number | null = null) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    if (!Object.isNull(revision) && (!Number.isSafeInteger(revision) || revision < 1))
      throw new ArgumentException(Resources.draftRevisionInvalid, Resources.revisionField);

    this.chatId = chatId;
    this.revision = revision;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): DraftDiscardParams {
    const reader = JsonReader.fromValue(value, path);
    return new DraftDiscardParams(reader.readNonBlankString(Resources.chatIdField), reader.readNullableInteger(Resources.revisionField));
  }

  public toJson(): JsonObject {
    return { [Resources.chatIdField]: this.chatId, [Resources.revisionField]: this.revision };
  }
}
