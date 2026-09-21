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

/**
 * Parameters of `ConversationMove`: the conversation and the project it moves to.
 */
export class ConversationMoveParams {
  public readonly conversationId: string;
  public readonly projectId: string;

  public constructor(conversationId: string, projectId: string) {
    ArgumentException.throwIfNullOrWhitespace(conversationId, Resources.conversationIdField);
    ArgumentException.throwIfNullOrWhitespace(projectId, Resources.projectIdField);

    this.conversationId = conversationId;
    this.projectId = projectId;
  }

  public static fromJson(value: unknown, path?: string): ConversationMoveParams {
    const reader = JsonReader.fromValue(value, path);
    return new ConversationMoveParams(reader.readNonBlankString(Resources.conversationIdField), reader.readNonBlankString(Resources.projectIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.conversationIdField]: this.conversationId,
      [Resources.projectIdField]: this.projectId
    };
  }
}
