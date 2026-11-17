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

export class ChatPlanFirstParams {
  public readonly chatId: string;
  public readonly planFirst: boolean;

  public constructor(chatId: string, planFirst: boolean) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);

    this.chatId = chatId;
    this.planFirst = planFirst;
  }

  public static fromJson(value: unknown, path?: string): ChatPlanFirstParams {
    const reader = JsonReader.fromValue(value, path);
    return new ChatPlanFirstParams(reader.readNonBlankString(Resources.chatIdField), reader.readBoolean(Resources.planFirstField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.planFirstField]: this.planFirst
    };
  }
}
