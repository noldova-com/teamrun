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

export class AttachmentReadParams {
  public readonly chatId: string;
  public readonly path: string;

  public constructor(chatId: string, path: string) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(path, Resources.pathField);

    this.chatId = chatId;
    this.path = path;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): AttachmentReadParams {
    const reader = JsonReader.fromValue(value, path);
    return new AttachmentReadParams(reader.readNonBlankString(Resources.chatIdField), reader.readNonBlankString(Resources.pathField));
  }

  public toJson(): JsonObject {
    return { [Resources.chatIdField]: this.chatId, [Resources.pathField]: this.path };
  }
}
