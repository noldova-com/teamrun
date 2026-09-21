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

export class ConversationRewindParams {
  public readonly conversationId: string;
  public readonly messageId: string;
  public readonly restoreFiles: boolean;

  public constructor(conversationId: string, messageId: string, restoreFiles: boolean) {
    ArgumentException.throwIfNullOrWhitespace(conversationId, Resources.conversationIdField);
    ArgumentException.throwIfNullOrWhitespace(messageId, Resources.messageIdField);

    this.conversationId = conversationId;
    this.messageId = messageId;
    this.restoreFiles = restoreFiles;
  }

  public static fromJson(value: unknown, path?: string): ConversationRewindParams {
    const reader = JsonReader.fromValue(value, path);
    return new ConversationRewindParams(
      reader.readNonBlankString(Resources.conversationIdField),
      reader.readNonBlankString(Resources.messageIdField),
      reader.readBoolean(Resources.restoreFilesField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.conversationIdField]: this.conversationId,
      [Resources.messageIdField]: this.messageId,
      [Resources.restoreFilesField]: this.restoreFiles
    };
  }
}
