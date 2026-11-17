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

export class ChatFindParams {
  public readonly query: string;
  public readonly limit: number;

  public constructor(query: string, limit: number) {
    if (!Number.isInteger(limit) || limit < 1 || limit > Resources.maximumSearchLimit)
      throw new ArgumentException(Resources.searchLimitOutOfRange, Resources.limitField);

    this.query = query.trim();
    this.limit = limit;
  }

  public static fromJson(value: unknown, path?: string): ChatFindParams {
    const reader = JsonReader.fromValue(value, path);
    return new ChatFindParams(reader.readString(Resources.queryField), reader.readInteger(Resources.limitField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.queryField]: this.query,
      [Resources.limitField]: this.limit
    };
  }
}
