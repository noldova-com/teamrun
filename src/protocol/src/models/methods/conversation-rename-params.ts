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

export class ConversationRenameParams {
  public readonly conversationId: string;
  public readonly title: string;

  public constructor(conversationId: string, title: string) {
    ArgumentException.throwIfNullOrWhitespace(conversationId, Resources.conversationIdField);
    ArgumentException.throwIfNullOrWhitespace(title, Resources.titleField);

    this.conversationId = conversationId;
    this.title = title;
  }

  public static fromJson(value: unknown, path?: string): ConversationRenameParams {
    const reader = JsonReader.fromValue(value, path);
    return new ConversationRenameParams(reader.readNonBlankString(Resources.conversationIdField), reader.readNonBlankString(Resources.titleField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.conversationIdField]: this.conversationId,
      [Resources.titleField]: this.title
    };
  }
}
