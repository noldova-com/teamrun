/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";

export class ConversationMemberParams {
  public readonly conversationId: string;
  public readonly teammateId: string;

  public constructor(
    conversationId: string,
    teammateId: string) {
    ArgumentException.throwIfNullOrWhitespace(conversationId, Resources.conversationIdField);
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);

    this.conversationId = conversationId;
    this.teammateId = teammateId;
  }

  public static fromJson(value: unknown, path?: string): ConversationMemberParams {
    const reader = JsonReader.fromValue(value, path);
    return new ConversationMemberParams(
      reader.readNonBlankString(Resources.conversationIdField),
      reader.readNonBlankString(Resources.teammateIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.conversationIdField]: this.conversationId,
      [Resources.teammateIdField]: this.teammateId
    };
  }
}
