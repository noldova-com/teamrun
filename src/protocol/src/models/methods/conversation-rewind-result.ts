/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";
import { Conversation } from "../conversation.js";

export class ConversationRewindResult {
  public readonly conversation: Conversation;
  public readonly removedMessageIds: readonly string[];
  public readonly restoredFiles: number | null;
  public readonly sessionKept: boolean;

  public constructor(conversation: Conversation, removedMessageIds: readonly string[], restoredFiles: number | null, sessionKept: boolean = false) {
    this.conversation = conversation;
    this.removedMessageIds = [...removedMessageIds];
    this.restoredFiles = restoredFiles;
    this.sessionKept = sessionKept;
  }

  public static fromJson(value: unknown, path?: string): ConversationRewindResult {
    const reader = JsonReader.fromValue(value, path);
    const conversation = reader.readObject(Resources.conversationField);
    return new ConversationRewindResult(
      Conversation.fromJson(conversation.toJson(), conversation.path),
      reader.readStringArray(Resources.removedMessageIdsField),
      reader.readNullableInteger(Resources.restoredFilesField),
      reader.hasField(Resources.sessionKeptField) ? reader.readBoolean(Resources.sessionKeptField) : false);
  }

  public toJson(): JsonObject {
    return {
      [Resources.conversationField]: this.conversation.toJson(),
      [Resources.removedMessageIdsField]: [...this.removedMessageIds],
      [Resources.restoredFilesField]: this.restoredFiles,
      [Resources.sessionKeptField]: this.sessionKept
    };
  }
}
