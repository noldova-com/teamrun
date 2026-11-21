/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class ChatFolderAttachParams {
  public readonly chatId: string;
  public readonly folder: string;

  public constructor(chatId: string, folder: string) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(folder, Resources.folderField);

    this.chatId = chatId;
    this.folder = folder;
  }

  public static fromJson(value: unknown, path?: string): ChatFolderAttachParams {
    const reader = JsonReader.fromValue(value, path);
    return new ChatFolderAttachParams(reader.readNonBlankString(Resources.chatIdField), reader.readNonBlankString(Resources.folderField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.folderField]: this.folder
    };
  }
}
