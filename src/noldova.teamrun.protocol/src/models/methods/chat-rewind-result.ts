/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";
import { Chat } from "../chat.js";

export class ChatRewindResult {
  public readonly chat: Chat;
  public readonly removedMessageIds: readonly string[];
  public readonly restoredFiles: number | null;
  public readonly sessionKept: boolean;
  public readonly restoreRefusal: string | null;

  public constructor(chat: Chat, removedMessageIds: readonly string[], restoredFiles: number | null, sessionKept: boolean = false,
    restoreRefusal: string | null = null) {
    this.chat = chat;
    this.removedMessageIds = [...removedMessageIds];
    this.restoredFiles = restoredFiles;
    this.sessionKept = sessionKept;
    this.restoreRefusal = restoreRefusal;
  }

  public get conversation(): Chat {
    return this.chat;
  }

  public static fromJson(value: unknown, path?: string): ChatRewindResult {
    const reader = JsonReader.fromValue(value, path);
    const chat = reader.readObject(Resources.chatField);
    return new ChatRewindResult(
      Chat.fromJson(chat.toJson(), chat.path),
      reader.readStringArray(Resources.removedMessageIdsField),
      reader.readNullableInteger(Resources.restoredFilesField),
      reader.hasField(Resources.sessionKeptField) ? reader.readBoolean(Resources.sessionKeptField) : false,
      reader.hasField(Resources.restoreRefusalField) ? reader.readNullableString(Resources.restoreRefusalField) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatField]: this.chat.toJson(),
      [Resources.removedMessageIdsField]: [...this.removedMessageIds],
      [Resources.restoredFilesField]: this.restoredFiles,
      [Resources.sessionKeptField]: this.sessionKept,
      [Resources.restoreRefusalField]: this.restoreRefusal
    };
  }
}
