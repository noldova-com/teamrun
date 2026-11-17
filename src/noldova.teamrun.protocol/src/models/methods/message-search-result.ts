/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";
import { MessageSearchHit } from "./message-search-hit.js";

export class MessageSearchResult {
  public readonly hits: readonly MessageSearchHit[];
  public readonly total: number;
  public readonly capped: boolean;

  public constructor(hits: readonly MessageSearchHit[], total: number, capped: boolean) {
    if (!Number.isInteger(total) || total < hits.length)
      throw new ArgumentOutOfRangeException(Resources.totalField, total);

    this.hits = [...hits];
    this.total = total;
    this.capped = capped;
  }

  public static fromJson(value: unknown, path?: string): MessageSearchResult {
    const reader = JsonReader.fromValue(value, path);
    return new MessageSearchResult(reader.readObjectArray(Resources.hitsField).map(t => MessageSearchHit.fromJson(t.toJson(), t.path)), reader.readInteger(Resources.totalField),
      reader.readBoolean(Resources.cappedField));
  }

  public toJson(): JsonObject {
    return { [Resources.hitsField]: this.hits.map(t => t.toJson()), [Resources.totalField]: this.total, [Resources.cappedField]: this.capped };
  }
}
