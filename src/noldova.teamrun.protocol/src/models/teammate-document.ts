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

import { Resources } from "../resources.js";

export class TeammateDocument {
  public readonly path: string;
  public readonly chatId: string;
  public readonly changedAt: string;

  public constructor(path: string, chatId: string, changedAt: string) {
    ArgumentException.throwIfNullOrWhitespace(path, Resources.pathField);
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(changedAt, Resources.changedAtField);

    this.path = path;
    this.chatId = chatId;
    this.changedAt = changedAt;
  }

  public static fromJson(value: unknown, path?: string): TeammateDocument {
    const reader = JsonReader.fromValue(value, path);
    return new TeammateDocument(reader.readNonBlankString(Resources.pathField), reader.readNonBlankString(Resources.chatIdField),
      reader.readNonBlankString(Resources.changedAtField));
  }

  public toJson(): JsonObject {
    return { [Resources.pathField]: this.path, [Resources.chatIdField]: this.chatId, [Resources.changedAtField]: this.changedAt };
  }
}
