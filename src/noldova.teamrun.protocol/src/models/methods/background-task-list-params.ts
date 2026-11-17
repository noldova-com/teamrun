/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class BackgroundTaskListParams {
  public readonly chatId: string;
  public readonly afterTaskId: string | null;
  public readonly limit: number;

  public constructor(chatId: string, afterTaskId: string | null, limit: number) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    if (!Object.isNull(afterTaskId))
      ArgumentException.throwIfNullOrWhitespace(afterTaskId, Resources.afterTaskIdField);
    if (!Number.isInteger(limit) || limit < 1 || limit > Resources.maximumPageSize)
      throw new ArgumentOutOfRangeException(Resources.limitField, limit);

    this.chatId = chatId;
    this.afterTaskId = afterTaskId;
    this.limit = limit;
  }

  public static fromJson(value: unknown, path?: string): BackgroundTaskListParams {
    const reader = JsonReader.fromValue(value, path);
    return new BackgroundTaskListParams(reader.readNonBlankString(Resources.chatIdField), reader.readNullableString(Resources.afterTaskIdField),
      reader.readInteger(Resources.limitField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.afterTaskIdField]: this.afterTaskId,
      [Resources.limitField]: this.limit
    };
  }
}
