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

export class ChatMemberModeParams {
  public readonly chatId: string;
  public readonly teammateId: string;
  public readonly mode: string | null;

  public constructor(chatId: string, teammateId: string, mode: string | null) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);
    if (!Object.isNull(mode))
      ArgumentException.throwIfNullOrWhitespace(mode, Resources.modeField);

    this.chatId = chatId;
    this.teammateId = teammateId;
    this.mode = mode;
  }

  public static fromJson(value: unknown, path?: string): ChatMemberModeParams {
    const reader = JsonReader.fromValue(value, path);
    return new ChatMemberModeParams(reader.readNonBlankString(Resources.chatIdField), reader.readNonBlankString(Resources.teammateIdField),
      reader.readNullableString(Resources.modeField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.teammateIdField]: this.teammateId,
      [Resources.modeField]: this.mode
    };
  }
}
