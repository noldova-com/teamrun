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

export class ConversationSearchParams {
  public readonly query: string;
  public readonly limit: number;

  public constructor(query: string, limit: number) {
    ArgumentException.throwIfNullOrWhitespace(query, Resources.queryField);
    if (!Number.isInteger(limit) || limit < 1 || limit > Resources.maximumSearchLimit)
      throw new ArgumentException(Resources.searchLimitOutOfRange, Resources.limitField);

    this.query = query;
    this.limit = limit;
  }

  public static fromJson(value: unknown, path?: string): ConversationSearchParams {
    const reader = JsonReader.fromValue(value, path);
    return new ConversationSearchParams(reader.readNonBlankString(Resources.queryField), reader.readInteger(Resources.limitField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.queryField]: this.query,
      [Resources.limitField]: this.limit
    };
  }
}
